import "colors";
import nodemailer from 'nodemailer';
import {emailTemplateHTML} from "../templates/emailTemplateHTML";
import {EMAIL_PASS, EMAIL_USER, FRONTEND_URL} from "../config/config";

class EmailService {
    private static transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
        },
    });

    /**
     * Send magic link email for passwordless authentication using nodemailer
     */
    static async sendMagicLink(email: string, token: string): Promise<void> {
        console.log('Service: EmailService.sendMagicLink called'.cyan.italic, {email, token: token.substring(0, 10) + '...'});
        
        try {
            const magicUrl = `${FRONTEND_URL}/api/v1/auth/verify-magic-link?token=${token}`;
            console.log('Magic link URL constructed'.cyan, {url: magicUrl.substring(0, 50) + '...'});

            const mailOptions = {
                from: `PulsePress <${EMAIL_USER}>`,
                to: email,
                subject: '✨ Your Magic Sign-In Link for PulsePress',
                html: emailTemplateHTML.replace(/{{MAGIC_URL}}/g, magicUrl),
            };

            console.log('External API: Sending email via nodemailer'.magenta, {to: email, subject: mailOptions.subject});
            await this.transporter.sendMail(mailOptions);
            console.log('External API: Email sent successfully'.magenta, {to: email});
            
            console.log('Magic link email sent successfully'.green.bold);
        } catch (error: any) {
            console.error('Service Error: EmailService.sendMagicLink failed'.red.bold, error);
            throw error;
        }
    }
}

export default EmailService;
