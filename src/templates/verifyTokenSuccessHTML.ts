export const verifyTokenSuccessHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to PulsePress!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center;">
    <div style="background: white; padding: 40px; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); text-align: center; max-width: 400px; margin: 20px;">
        <div style="background: #f0fff4; border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 36px;">✅</span>
        </div>
        <h1 style="color: #38a169; margin: 0 0 16px; font-size: 24px; font-weight: 600;">Welcome to PulsePress!</h1>
        <p style="color: #666; margin: 0 0 24px; line-height: 1.5;">You've been successfully signed in. This window will close automatically in a few seconds.</p>
        <button onclick="window.close()" style="background: #38a169; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; cursor: pointer;">Close Window</button>
    </div>
    <script>
        setTimeout(() => {
            try {
                window.close();
            } catch (e) {
                console.log('Could not close window');
            }
        }, 5000);
    </script>
</body>
</html>
`;
