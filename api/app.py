import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

# Allow browser extension to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Model definition (must match training code exactly) ───────────────────────

class MLPclassifier(nn.Module):
    def __init__(self, input_dim=768, hidden_dim=128, dropout=0.5):
        super().__init__()
        self.pre_model1 = nn.Linear(input_dim, input_dim // 2)
        self.pre_model2 = nn.Linear(input_dim, input_dim // 2)
        self.linear_relu_tweet = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.LeakyReLU(),
        )
        self.dropout = nn.Dropout(p=dropout)
        self.classifier = nn.Linear(hidden_dim, 2)

    def forward(self, t, d):
        x = torch.cat((self.pre_model1(t), self.pre_model2(d)), dim=1)
        x = self.linear_relu_tweet(x)
        return self.classifier(self.dropout(x))

# ── Load models once at startup ───────────────────────────────────────────────

DEVICE = torch.device("cpu")
TWEET_MAX_LEN = 50
DESC_MAX_LEN = 64

print("Loading roberta-base tokenizer and encoder...")
tok = AutoTokenizer.from_pretrained("roberta-base")
enc = AutoModel.from_pretrained("roberta-base").to(DEVICE).eval()
for p in enc.parameters():
    p.requires_grad_(False)

print("Loading MLP classifier weights...")
mlp = MLPclassifier().to(DEVICE)
mlp.load_state_dict(torch.load("mlp_best.pt", map_location=DEVICE))
mlp.eval()
print("Ready.")

# ── Encoding helper ───────────────────────────────────────────────────────────

@torch.no_grad()
def encode_and_pool(texts: List[str], max_len: int) -> torch.Tensor:
    """
    Tokenize a list of texts, run through RoBERTa, mean-pool token embeddings
    per text, then mean-pool across texts to get a single [1, 768] vector.
    Mirrors the encoding logic used during training.
    """
    if not texts:
        return torch.zeros(1, 768)

    batch = tok(
        texts,
        padding=True,
        truncation=True,
        max_length=max_len,
        return_tensors="pt",
    ).to(DEVICE)

    out = enc(**batch).last_hidden_state                          # [N, seq, 768]
    mask = batch["attention_mask"].unsqueeze(-1).float()          # [N, seq, 1]
    per_text = (out * mask).sum(1) / mask.sum(1).clamp(min=1)    # [N, 768]
    return per_text.mean(0, keepdim=True).cpu()                   # [1, 768]

# ── Request / response schemas ────────────────────────────────────────────────

class PredictRequest(BaseModel):
    tweets: List[str]
    description: Optional[str] = ""

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict(req: PredictRequest):
    # Drop blank tweets and cap at 20 (matches MAX_TWEETS_PER_USER in training)
    tweets = [t for t in req.tweets if t.strip()][:20]
    if not tweets:
        raise HTTPException(status_code=400, detail="At least one non-empty tweet is required.")

    tweet_emb = encode_and_pool(tweets, TWEET_MAX_LEN).to(DEVICE)
    desc_emb  = encode_and_pool([req.description or " "], DESC_MAX_LEN).to(DEVICE)

    logits = mlp(tweet_emb, desc_emb)
    probs  = F.softmax(logits, dim=-1).cpu()

    p_bot = probs[0, 1].item()

    return {
        "label":           "bot" if p_bot >= 0.5 else "human",
        "p_bot":           round(p_bot, 4),
        "p_human":         round(1 - p_bot, 4),
        "confidence":      round(float(probs.max()), 4),
        "tweets_analyzed": len(tweets),
    }
