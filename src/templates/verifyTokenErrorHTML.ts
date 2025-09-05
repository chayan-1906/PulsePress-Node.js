export const verifyTokenErrorHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authentication Error - PulsePress</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center;">
    <div style="background: white; padding: 40px; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); text-align: center; max-width: 400px; margin: 20px;">
        <div style="background: #fee; border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 36px;">⚠️</span>
        </div>
        <h1 style="color: #e53e3e; margin: 0 0 16px; font-size: 24px; font-weight: 600;">Authentication Failed</h1>
        <p style="color: #666; margin: 0 0 24px; line-height: 1.5;">This magic link has expired or is invalid. Magic links are only valid for 15 minutes for security reasons.</p>

        <div style="margin-bottom: 24px;">
            <input type="email" id="emailInput" placeholder="Enter your email address" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; margin-bottom: 12px; box-sizing: border-box;">
            <button id="requestNewLinkBtn" style="width: 100%; background: #667eea; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 500; cursor: pointer; font-size: 14px;">Request New Magic Link</button>
            <div id="statusMessage" style="margin-top: 12px; font-size: 14px; display: none;"></div>
        </div>
        
        <button onclick="window.close()" style="background: #f7fafc; color: #667eea; border: 1px solid #e2e8f0; padding: 12px 24px; border-radius: 8px; font-weight: 500; cursor: pointer;">Close Window</button>
    </div>
    
    <script>
        document.getElementById('requestNewLinkBtn').addEventListener('click', async function() {
            const email = document.getElementById('emailInput').value;
            const statusDiv = document.getElementById('statusMessage');
            const button = document.getElementById('requestNewLinkBtn');
            
            if (!email) {
                statusDiv.style.display = 'block';
                statusDiv.style.color = '#e53e3e';
                statusDiv.textContent = 'Please enter your email address';
                return;
            }
            
            // Disable button and show loading
            button.disabled = true;
            button.textContent = 'Sending...';
            statusDiv.style.display = 'block';
            statusDiv.style.color = '#666';
            statusDiv.textContent = 'Sending magic link...';
            
            try {
                const response = await fetch('/api/v1/auth/magic-link', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: email }),
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    statusDiv.style.color = '#38a169';
                    statusDiv.textContent = 'Magic link sent! Check your email.';
                    button.textContent = 'Sent ✓';
                } else {
                    statusDiv.style.color = '#e53e3e';
                    statusDiv.textContent = data.errorMsg || 'Failed to send magic link. Please try again.';
                    button.disabled = false;
                    button.textContent = 'Request New Magic Link';
                }
            } catch (error) {
                statusDiv.style.color = '#e53e3e';
                statusDiv.textContent = 'Network error. Please try again.';
                button.disabled = false;
                button.textContent = 'Request New Magic Link';
            }
        });
        
        // Allow Enter key to submit
        document.getElementById('emailInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                document.getElementById('requestNewLinkBtn').click();
            }
        });
    </script>
</body>
</html>
`;
