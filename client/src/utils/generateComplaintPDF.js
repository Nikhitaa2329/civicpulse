import jsPDF from 'jspdf';

// Formats a date consistently throughout the PDF
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const CATEGORY_LABELS = {
  waterlogging: 'Waterlogging',
  power_outage: 'Power Outage',
  broken_road: 'Broken Road',
  garbage: 'Garbage',
  streetlight: 'Streetlight',
  water_supply: 'Water Supply',
  open_manhole: 'Open Manhole',
  other: 'Other',
};

const STATUS_LABELS = {
  pending_validation: 'Pending Validation',
  open: 'Open',
  in_progress: 'In Progress',
  overdue: 'Overdue',
  pending_verification: 'Pending Verification',
  resolved: 'Resolved',
  reopened: 'Reopened',
};

// Converts an image URL to base64 for embedding in PDF
// Uses a canvas element to bypass CORS restrictions
const loadImageAsBase64 = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(null); // silently skip if image fails to load
    img.src = url;
  });
};

export const generateComplaintPDF = async (complaint) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 0; // tracks current vertical position

  // ── HEADER BAND ───────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // CivicPulse logo text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('CivicPulse', margin, 16);

  // Blue accent on "Pulse" — approximate with a colored rectangle behind it
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFont('helvetica', 'normal');
  doc.text('Tamil Nadu Civic Accountability', margin, 23);

  // Report label on the right
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.text('COMPLAINT REPORT', pageWidth - margin, 16, { align: 'right' });
  doc.text(`Generated ${new Date().toLocaleDateString('en-IN')}`, pageWidth - margin, 23, { align: 'right' });

  y = 38;

  // ── COMPLAINT TITLE ────────────────────────────────────────────────────────
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');

  // Word wrap long titles
  const titleLines = doc.splitTextToSize(complaint.title, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 3;

  // Category + status on same line
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // slate-500
  const categoryLabel = CATEGORY_LABELS[complaint.category] || complaint.category;
  const statusLabel = STATUS_LABELS[complaint.status] || complaint.status;
  doc.text(`${categoryLabel.toUpperCase()}  ·  ${statusLabel.toUpperCase()}`, margin, y);
  y += 8;

  // Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── DESCRIPTION ───────────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.setFont('helvetica', 'normal');
  const descLines = doc.splitTextToSize(complaint.description || 'No description provided.', contentWidth);
  doc.text(descLines, margin, y);
  y += descLines.length * 5 + 8;

  // ── META GRID ─────────────────────────────────────────────────────────────
  // Two columns of key-value pairs
  const metaItems = [
    { label: 'LOCATION', value: complaint.location?.address || `${complaint.location?.lat}, ${complaint.location?.lng}` },
    { label: 'PINCODE', value: complaint.pincode || 'Not specified' },
    { label: 'FILED', value: formatDate(complaint.createdAt) },
    { label: 'REPORTED BY', value: complaint.filedBy?.name || 'Citizen' },
    { label: 'ASSIGNED TO', value: complaint.assignedTo?.name || 'Not yet assigned' },
    { label: 'SLA DEADLINE', value: complaint.slaDeadline ? formatDate(complaint.slaDeadline) : 'Not set' },
    { label: 'AFFECTED CITIZENS', value: String(complaint.affectedCount || 1) },
    { label: 'COMPLAINT ID', value: complaint._id?.toString() || 'N/A' },
  ];

  const colWidth = contentWidth / 2;
  let leftY = y;
  let rightY = y;

  metaItems.forEach((item, index) => {
    const isLeft = index % 2 === 0;
    const x = isLeft ? margin : margin + colWidth;
    const currentY = isLeft ? leftY : rightY;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(item.label, x, currentY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59); // slate-800
    const valueLines = doc.splitTextToSize(item.value, colWidth - 5);
    doc.text(valueLines, x, currentY + 4);

    const rowHeight = valueLines.length * 4 + 8;
    if (isLeft) leftY += rowHeight;
    else rightY += rowHeight;
  });

  y = Math.max(leftY, rightY) + 4;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── TIMELINE ──────────────────────────────────────────────────────────────
  if (complaint.timeline && complaint.timeline.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Activity Timeline', margin, y);
    y += 7;

    complaint.timeline.forEach((entry, index) => {
      // Check if we need a new page
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }

      // Dot
      doc.setFillColor(
        index === complaint.timeline.length - 1 ? 59 : 148,
        index === complaint.timeline.length - 1 ? 130 : 163,
        index === complaint.timeline.length - 1 ? 246 : 184
      );
      doc.circle(margin + 2, y - 1, 1.5, 'F');

      // Event text
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      const eventLines = doc.splitTextToSize(entry.event, contentWidth - 10);
      doc.text(eventLines, margin + 8, y);
      y += eventLines.length * 4;

      // Timestamp
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(formatDate(entry.timestamp), margin + 8, y + 1);
      y += 7;
    });
  }

  // ── PHOTOS ────────────────────────────────────────────────────────────────
  if (complaint.beforePhoto || complaint.afterPhoto) {
    if (y > pageHeight - 80) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Photo Evidence', margin, y);
    y += 7;

    const imgWidth = (contentWidth - 8) / 2;
    const imgHeight = 50;
    const labelY = y;      // save Y position for both labels
    const imageY = y + 4;  // images start 4mm below labels

    // Draw BEFORE label and image
    if (complaint.beforePhoto) {
      const beforeBase64 = await loadImageAsBase64(complaint.beforePhoto);
      if (beforeBase64) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(148, 163, 184);
        doc.text('BEFORE', margin, labelY);
        doc.addImage(beforeBase64, 'JPEG', margin, imageY, imgWidth, imgHeight);
      }
    }

    // Draw AFTER label and image — same labelY and imageY as BEFORE
    if (complaint.afterPhoto) {
      const afterBase64 = await loadImageAsBase64(complaint.afterPhoto);
      if (afterBase64) {
        const afterX = margin + imgWidth + 8;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(148, 163, 184);
        doc.text('AFTER (PROOF OF FIX)', afterX, labelY);
        doc.addImage(afterBase64, 'JPEG', afterX, imageY, imgWidth, imgHeight);
      }
    }

    y += 4 + imgHeight + 8; // advance y past both images
  }
  // ── FOOTER ────────────────────────────────────────────────────────────────
  // Add footer on every page
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      'This document was generated by CivicPulse — Tamil Nadu Civic Accountability Platform',
      margin,
      pageHeight - 6
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  // ── SAVE ──────────────────────────────────────────────────────────────────
  const filename = `civicpulse-complaint-${complaint._id?.toString().slice(-8)}.pdf`;
  doc.save(filename);
};