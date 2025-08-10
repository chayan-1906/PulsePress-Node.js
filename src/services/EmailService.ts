import nodemailer from 'nodemailer';
import {emailTemplateHTML} from "../templates/emailTemplateHTML";
import {EMAIL_PASS, EMAIL_USER, FRONTEND_URL} from "../config/config";

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },
});

const sendMagicLink = async (email: string, token: string) => {
    const magicUrl = `${FRONTEND_URL}/api/v1/auth/verify-magic-link?token=${token}`;

    const mailOptions = {
        from: `PulsePress <${EMAIL_USER}>`,
        to: email,
        subject: '✨ Your Magic Sign-In Link for PulsePress',
        html: emailTemplateHTML.replace(/{{MAGIC_URL}}/g, magicUrl),
    };

    await transporter.sendMail(mailOptions);
}

export {sendMagicLink};
