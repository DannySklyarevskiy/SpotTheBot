import torch.nn as nn
import torch.nn.functional as F

class FF_Net(nn.Module):
    def __init__(self):
        super().__init__()

        # Layers (input dim will depend on data preprocessing!)
        self.fc1 = nn.Linear(784, 512)
        self.fc2 = nn.Linear(512, 256)
        self.fc3 = nn.Linear(256, 128)
        self.fc4 = nn.Linear(128, 10)

        # Dropout for regularization
        self.dropout = nn.Dropout(0.2)

    def forward(self, x):
        # Flatten
        x = x.view(-1, 784)

        # Pass through layers with ReLU activation
        x = F.relu(self.fc1(x))
        x = self.dropout(x)

        x = F.relu(self.fc2(x))
        x = self.dropout(x)
        
        x = F.relu(self.fc3(x))
        x = self.dropout(x)

        x = self.fc4(x)

        return x
        
