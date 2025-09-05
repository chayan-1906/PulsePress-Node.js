export const emailTemplateHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign in to PulsePress</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background-color: #667eea;
            padding: 40px 20px;
            min-height: 100vh;
        }

        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 40px 60px;
            text-align: center;
        }

        .logo {
            width: 60px;
            height: 60px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 16px;
            margin: 0 auto 20px auto;
            border: 1px solid rgba(255, 255, 255, 0.3);
            font-size: 28px;
            line-height: 60px;
            text-align: center;
            display: block;
        }

        .brand-name {
            color: #ffffff;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            text-align: center;
        }

        .tagline {
            color: rgba(255, 255, 255, 0.9);
            font-size: 16px;
            font-weight: 400;
            text-align: center;
        }

        .content {
            padding: 50px 40px;
            background: #ffffff;
        }

        .welcome-title {
            font-size: 32px;
            font-weight: 700;
            color: #667eea;
            text-align: center;
            margin-bottom: 16px;
        }

        .welcome-subtitle {
            font-size: 18px;
            color: #6b7280;
            text-align: center;
            margin-bottom: 40px;
            line-height: 1.5;
        }

        .cta-container {
            text-align: center;
            margin: 40px 0;
        }

        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff !important;
            padding: 18px 40px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            letter-spacing: 0.5px;
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }

        .divider {
            text-align: center;
            margin: 40px 0;
            color: #9ca3af;
            font-size: 14px;
            position: relative;
        }

        .divider-line {
            height: 1px;
            background: #e5e7eb;
            margin: 10px 0;
        }

        .backup-link {
            background: #f9fafb;
            border: 2px dashed #d1d5db;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
        }

        .backup-link p {
            color: #6b7280;
            font-size: 14px;
            margin-bottom: 10px;
        }

        .link-text {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px 16px;
            font-family: Monaco, Menlo, monospace;
            font-size: 12px;
            color: #667eea;
            word-break: break-all;
            margin: 8px 0;
        }

        .security-info {
            background: rgba(102, 126, 234, 0.1);
            border-radius: 12px;
            padding: 24px;
            margin: 30px 0;
            border-left: 4px solid #667eea;
        }
        
        .security-info h4 {
            color: #1a1a1a;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .security-info p {
            color: #6b7280;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .footer {
            background: #f9fafb;
            padding: 30px 40px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        
        .footer-text {
            color: #9ca3af;
            font-size: 14px;
            margin-bottom: 16px;
        }
        
        .social-links {
            margin-bottom: 20px;
        }
        
        .social-link {
            color: #667eea;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            margin: 0 12px;
        }
        
        .copyright {
            color: #d1d5db;
            font-size: 12px;
        }
        
        /* Mobile Responsive */
        @media only screen and (max-width: 600px) {
            body {
                padding: 20px 10px;
            }
            
            .email-container {
                border-radius: 16px;
            }
            
            .header {
                padding: 30px 20px 40px;
            }
            
            .content {
                padding: 30px 20px;
            }
            
            .welcome-title {
                font-size: 24px;
            }
            
            .welcome-subtitle {
                font-size: 16px;
            }
            
            .cta-button {
                padding: 16px 32px;
                font-size: 15px;
            }
            
            .footer {
                padding: 20px;
            }
            
            .social-link {
                display: block;
                margin: 8px 0;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="header">
            <div class="logo">📰</div>
            <h1 class="brand-name">PulsePress</h1>
            <p class="tagline">Your Gateway to Curated News</p>
        </div>

        <!-- Main Content -->
        <div class="content">
            <h2 class="welcome-title">Welcome Back!</h2>
            <p class="welcome-subtitle">We've prepared your personalized magic link to sign you in securely. No passwords needed – just one click!</p>

            <!-- CTA Button -->
            <div class="cta-container">
                <a href="{{MAGIC_URL}}" class="cta-button">
                    ✨ Sign In Securely
                </a>
            </div>

            <!-- Divider -->
            <div class="divider">
                <div class="divider-line"></div>
                <span>Or copy the link below</span>
                <div class="divider-line"></div>
            </div>

            <!-- Backup Link -->
            <div class="backup-link">
                <p>Can't click the button? Copy and paste this link:</p>
                <div class="link-text">{{MAGIC_URL}}</div>
            </div>

            <!-- Security Info -->
            <div class="security-info">
                <h4>🔒 Security Notice</h4>
                <p>This magic link will expire in <strong>15 minutes</strong> for your security. If you didn't request this sign-in, you can safely ignore this email.</p>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p class="footer-text">This email was sent to verify your PulsePress account access.</p>
            <div class="social-links">
                <a href="https://github.com/chayan-1906" class="social-link">🐙 GitHub</a>
                <a href="https://www.linkedin.com/in/padmanabha-das-59bb2019b/" class="social-link">💼 LinkedIn</a>
                <a href="mailto:chayan.codes@gmail.com" class="social-link">📧 Contact</a>
            </div>
            <p class="copyright">
                © 2025 PulsePress by Chayan Das. Personal Project.
            </p>
        </div>
    </div>
</body>
</html>
`;
