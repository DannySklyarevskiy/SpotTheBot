document.getElementById('generateBtn').addEventListener('click', async () => {
  const resultDiv = document.getElementById('result');
  resultDiv.textContent = 'Loading...';
  
  try {
    const response = await fetch('http://www.randomnumberapi.com/api/v1.0/random?min=1&max=100&count=1');
    
    const data = await response.json();
    const randomNumber = data[0];
    
    resultDiv.textContent = randomNumber;
  } catch (error) {
    resultDiv.textContent = 'Error: Could not fetch number';
    console.error('Error:', error);
  }
});