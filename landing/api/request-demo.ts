import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'

const DEFAULT_TARGET_EMAIL = 'Admin@drevora.uk'
const FROM_EMAIL = 'DREVORA Demo <noreply@drevora.uk>'

type DemoRequestBody = {
    fullName?: string
    companyName?: string
    workEmail?: string
    vehicleCount?: string
    message?: string
}

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function buildPlainTextEmail(fields: {
    fullName: string
    companyName: string
    workEmail: string
    vehicleCount: string
    message: string
}) {
    return `DREVORA
New demo request

Full Name: ${fields.fullName}
Company Name: ${fields.companyName}
Work Email: ${fields.workEmail}
Number of Vehicles: ${fields.vehicleCount}
Message: ${fields.message || '(none)'}

This request was submitted from the DREVORA landing page.`
}

function buildHtmlEmail(fields: {
    fullName: string
    companyName: string
    workEmail: string
    vehicleCount: string
    message: string
}) {
    const messageDisplay = fields.message
        ? escapeHtml(fields.message).replace(/\n/g, '<br>')
        : '(none)'

    const rows = [
        ['Full Name', escapeHtml(fields.fullName)],
        ['Company Name', escapeHtml(fields.companyName)],
        ['Work Email', escapeHtml(fields.workEmail)],
        ['Number of Vehicles', escapeHtml(fields.vehicleCount)],
        ['Message', messageDisplay],
    ]

    const tableRows = rows
        .map(
            ([label, value]) => `
                <tr>
                    <td style="padding:12px 16px;border-bottom:1px solid #e8eef5;color:#5b6b7c;font-size:14px;width:160px;vertical-align:top;">${label}</td>
                    <td style="padding:12px 16px;border-bottom:1px solid #e8eef5;color:#1a2b3c;font-size:14px;vertical-align:top;">${value}</td>
                </tr>`
        )
        .join('')

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New DREVORA demo request</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f8fc;font-family:Arial,Helvetica,sans-serif;color:#1a2b3c;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f8fc;padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #dbe7f3;border-radius:12px;overflow:hidden;">
                    <tr>
                        <td style="background-color:#3b82c4;padding:24px 28px;">
                            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">DREVORA</p>
                            <p style="margin:8px 0 0;font-size:16px;color:#e8f2fb;">New demo request</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0 4px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                ${tableRows}
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px 28px 24px;border-top:1px solid #e8eef5;">
                            <p style="margin:0;font-size:12px;line-height:1.5;color:#7a8a9a;">This request was submitted from the DREVORA landing page.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!process.env.RESEND_API_KEY) {
        console.error('RESEND_API_KEY is not configured')
        return res.status(500).json({ error: 'Email service not configured' })
    }

    const body = (req.body ?? {}) as DemoRequestBody
    const fullName = body.fullName?.trim() ?? ''
    const companyName = body.companyName?.trim() ?? ''
    const workEmail = body.workEmail?.trim() ?? ''
    const vehicleCount = body.vehicleCount?.trim() ?? ''
    const message = body.message?.trim() ?? ''

    if (!fullName || !companyName || !workEmail || !vehicleCount) {
        return res.status(400).json({ error: 'Missing required fields' })
    }

    if (!isValidEmail(workEmail)) {
        return res.status(400).json({ error: 'Invalid email address' })
    }

    const targetEmail = process.env.DEMO_REQUEST_EMAIL || DEFAULT_TARGET_EMAIL
    const resend = new Resend(process.env.RESEND_API_KEY)

    const fields = { fullName, companyName, workEmail, vehicleCount, message }

    try {
        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: [targetEmail],
            replyTo: workEmail,
            subject: 'New DREVORA demo request',
            text: buildPlainTextEmail(fields),
            html: buildHtmlEmail(fields),
        })

        if (error) {
            console.error('Resend error:', error)
            return res.status(500).json({ error: 'Failed to send email' })
        }

        return res.status(200).json({ success: true })
    } catch (err) {
        console.error('Request demo error:', err)
        return res.status(500).json({ error: 'Failed to send email' })
    }
}
