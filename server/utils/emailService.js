const nodemailer = require('nodemailer');

// Create reusable transporter using Gmail SMTP
// App Password bypasses 2FA — never use your actual Gmail password here
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error('[Email] SMTP connection failed:', error.message);
  } else {
    console.log('[Email] SMTP connection established — ready to send');
  }
});

const FROM_ADDRESS = `CivicPulse <${process.env.EMAIL_FROM}>`;

// ── EMAIL TEMPLATES ──────────────────────────────────────────────────────────

const templates = {

  complaintOpen: (complaintTitle, complaintId) => ({
    subject: `Your complaint is now open — "${complaintTitle}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
        <div style="background: #0f172a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 18px; font-weight: 900; letter-spacing: -0.5px;">
            Civic<span style="color: #60a5fa;">Pulse</span>
          </h1>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 12px;">Tamil Nadu Civic Accountability</p>
        </div>
        <div style="background: white; padding: 28px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #1d4ed8; font-size: 13px; font-weight: 600;">✓ Complaint validated by community</p>
          </div>
          <h2 style="color: #0f172a; font-size: 16px; font-weight: 800; margin: 0 0 8px;">${complaintTitle}</h2>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            Your complaint has been confirmed by neighbours in your area and is now officially open.
            It has been added to the priority queue and will be assigned to a ward officer shortly.
          </p>
          <a href="${process.env.CLIENT_URL}/complaints/${complaintId}"
             style="display: inline-block; background: #0f172a; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 700;">
            View complaint →
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 16px;">
          CivicPulse — Tamil Nadu Civic Accountability Platform
        </p>
      </div>
    `,
  }),

  complaintAssigned: (complaintTitle, complaintId, officialName) => ({
    subject: `Official assigned to "${complaintTitle}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
        <div style="background: #0f172a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 18px; font-weight: 900; letter-spacing: -0.5px;">
            Civic<span style="color: #60a5fa;">Pulse</span>
          </h1>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 12px;">Tamil Nadu Civic Accountability</p>
        </div>
        <div style="background: white; padding: 28px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #92400e; font-size: 13px; font-weight: 600;">⚡ An official is now handling your complaint</p>
          </div>
          <h2 style="color: #0f172a; font-size: 16px; font-weight: 800; margin: 0 0 8px;">${complaintTitle}</h2>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            <strong>${officialName}</strong> has accepted responsibility for this complaint.
            It is now in progress and should be resolved within the SLA window.
          </p>
          <a href="${process.env.CLIENT_URL}/complaints/${complaintId}"
             style="display: inline-block; background: #0f172a; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 700;">
            Track progress →
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 16px;">
          CivicPulse — Tamil Nadu Civic Accountability Platform
        </p>
      </div>
    `,
  }),

  verificationNeeded: (complaintTitle, complaintId, isSuspicious) => ({
    subject: `Your vote needed — "${complaintTitle}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
        <div style="background: #0f172a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 18px; font-weight: 900; letter-spacing: -0.5px;">
            Civic<span style="color: #60a5fa;">Pulse</span>
          </h1>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 12px;">Tamil Nadu Civic Accountability</p>
        </div>
        <div style="background: white; padding: 28px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="background: ${isSuspicious ? '#fef3c7' : '#f5f3ff'}; border: 1px solid ${isSuspicious ? '#fcd34d' : '#ddd6fe'}; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: ${isSuspicious ? '#92400e' : '#5b21b6'}; font-size: 13px; font-weight: 600;">
              ${isSuspicious
                ? '⚠ Proof submitted — please verify carefully'
                : '🗳 An official has submitted proof of fix'}
            </p>
          </div>
          <h2 style="color: #0f172a; font-size: 16px; font-weight: 800; margin: 0 0 8px;">${complaintTitle}</h2>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            ${isSuspicious
              ? 'An official submitted proof of fix, but our system flagged the before and after photos as potentially similar. Please review the photos carefully before voting.'
              : "An official has submitted an after-photo as proof that this issue has been resolved. As someone who reported or confirmed this complaint, your vote determines whether it's genuinely fixed."
            }
          </p>
          <a href="${process.env.CLIENT_URL}/complaints/${complaintId}"
             style="display: inline-block; background: #7c3aed; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 700;">
            Vote now →
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 16px;">
          CivicPulse — Tamil Nadu Civic Accountability Platform
        </p>
      </div>
    `,
  }),

  complaintReopenedCitizen: (complaintTitle, complaintId) => ({
    subject: `Complaint reopened — "${complaintTitle}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
        <div style="background: #0f172a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 18px; font-weight: 900; letter-spacing: -0.5px;">
            Civic<span style="color: #60a5fa;">Pulse</span>
          </h1>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 12px;">Tamil Nadu Civic Accountability</p>
        </div>
        <div style="background: white; padding: 28px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #9a3412; font-size: 13px; font-weight: 600;">↩ Complaint has been reopened</p>
          </div>
          <h2 style="color: #0f172a; font-size: 16px; font-weight: 800; margin: 0 0 8px;">${complaintTitle}</h2>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            Community voting determined this issue was not genuinely fixed.
            The complaint has been reopened and will be reassigned to an official for proper resolution.
            We apologise for the delay.
          </p>
          <a href="${process.env.CLIENT_URL}/complaints/${complaintId}"
             style="display: inline-block; background: #0f172a; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 700;">
            View complaint →
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 16px;">
          CivicPulse — Tamil Nadu Civic Accountability Platform
        </p>
      </div>
    `,
  }),

  complaintReopenedOfficial: (complaintTitle, complaintId, notFixedVotes, totalVotes) => ({
    subject: `Your fix was rejected — "${complaintTitle}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
        <div style="background: #0f172a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 18px; font-weight: 900; letter-spacing: -0.5px;">
            Civic<span style="color: #60a5fa;">Pulse</span>
          </h1>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 12px;">Tamil Nadu Civic Accountability</p>
        </div>
        <div style="background: white; padding: 28px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #991b1b; font-size: 13px; font-weight: 600;">✗ Fix rejected by community vote</p>
          </div>
          <h2 style="color: #0f172a; font-size: 16px; font-weight: 800; margin: 0 0 8px;">${complaintTitle}</h2>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 12px;">
            ${notFixedVotes} out of ${totalVotes} citizens voted that this issue was not actually fixed.
            The complaint has been reopened and your credibility score has been reduced by 10 points.
          </p>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            Please revisit the location and ensure the issue is properly resolved before resubmitting proof.
          </p>
          <a href="${process.env.CLIENT_URL}/complaints/${complaintId}"
             style="display: inline-block; background: #dc2626; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 700;">
            View complaint →
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 16px;">
          CivicPulse — Tamil Nadu Civic Accountability Platform
        </p>
      </div>
    `,
  }),

  slaWarning: (complaintTitle, complaintId, hoursRemaining) => ({
    subject: `⚠ SLA breach in ${hoursRemaining}h — "${complaintTitle}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
        <div style="background: #0f172a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 18px; font-weight: 900; letter-spacing: -0.5px;">
            Civic<span style="color: #60a5fa;">Pulse</span>
          </h1>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 12px;">Tamil Nadu Civic Accountability</p>
        </div>
        <div style="background: white; padding: 28px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
            <p style="margin: 0; color: #92400e; font-size: 13px; font-weight: 600;">
              ⚠ SLA deadline in approximately ${hoursRemaining} hours
            </p>
          </div>
          <h2 style="color: #0f172a; font-size: 16px; font-weight: 800; margin: 0 0 8px;">${complaintTitle}</h2>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            This complaint is approaching its SLA deadline. If it is not resolved in time,
            it will be publicly marked as overdue on the CivicPulse map and your credibility
            score will be affected. Please prioritise this complaint.
          </p>
          <a href="${process.env.CLIENT_URL}/complaints/${complaintId}"
             style="display: inline-block; background: #d97706; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 700;">
            View complaint →
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 16px;">
          CivicPulse — Tamil Nadu Civic Accountability Platform
        </p>
      </div>
    `,
  }),

};

// ── SEND FUNCTION ─────────────────────────────────────────────────────────────

const sendEmail = async (to, template) => {
  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to,
      subject: template.subject,
      html: template.html,
    });
    console.log(`[Email] Sent "${template.subject}" to ${to}`);
  } catch (error) {
    // Email failures never crash the main workflow
    console.error(`[Email] Failed to send to ${to}:`, error.message);
  }
};

// ── EXPORTS ───────────────────────────────────────────────────────────────────

module.exports = {
  sendComplaintOpenEmail: (to, title, id) =>
    sendEmail(to, templates.complaintOpen(title, id)),

  sendComplaintAssignedEmail: (to, title, id, officialName) =>
    sendEmail(to, templates.complaintAssigned(title, id, officialName)),

  sendVerificationNeededEmail: (to, title, id, isSuspicious) =>
    sendEmail(to, templates.verificationNeeded(title, id, isSuspicious)),

  sendReopenedCitizenEmail: (to, title, id) =>
    sendEmail(to, templates.complaintReopenedCitizen(title, id)),

  sendReopenedOfficialEmail: (to, title, id, notFixedVotes, totalVotes) =>
    sendEmail(to, templates.complaintReopenedOfficial(title, id, notFixedVotes, totalVotes)),

  sendSLAWarningEmail: (to, title, id, hoursRemaining) =>
    sendEmail(to, templates.slaWarning(title, id, hoursRemaining)),
};