
-- Create or update the email template for verification emails
UPDATE auth.templates
SET template = '
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your email</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .content {
      background-color: #f9f9f9;
      padding: 20px;
      border-radius: 5px;
    }
    .button {
      display: inline-block;
      background-color: #0275d8;
      color: #ffffff !important;
      padding: 10px 20px;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
    }
    .footer {
      margin-top: 20px;
      font-size: 12px;
      color: #777;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>Hero TV Mounting - Email Verification</h2>
  </div>
  <div class="content">
    <p>Hello {{ .Email }},</p>
    <p>You are being added as a Technician at Hero TV Mounting. Please verify your email to get started.</p>
    <p style="text-align:center;">
      <a href="{{ .ConfirmationURL }}" class="button">Verify Email Address</a>
    </p>
    <p>If you did not request this verification, please ignore this email.</p>
  </div>
  <div class="footer">
    <p>&copy; 2025 Hero TV Mounting. All rights reserved.</p>
  </div>
</body>
</html>
'
WHERE template_type = 'confirmation';
