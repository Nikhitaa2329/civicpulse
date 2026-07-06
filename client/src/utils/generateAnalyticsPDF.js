import jsPDF from 'jspdf';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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

export const generateAnalyticsPDF = async (data) => {
  const {
    complaints,
    escalationStats,
    recurringIssues,
    generatedBy,
  } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // ── HEADER ────────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('CivicPulse', margin, 14);

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.text('Tamil Nadu Civic Accountability', margin, 21);
  doc.text('Ward Analytics Report', margin, 27);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('AREA ANALYTICS REPORT', pageWidth - margin, 14, { align: 'right' });
  doc.text(`Generated ${new Date().toLocaleDateString('en-IN')}`, pageWidth - margin, 21, { align: 'right' });
  if (generatedBy) {
    doc.text(`By: ${generatedBy}`, pageWidth - margin, 27, { align: 'right' });
  }

  y = 42;

  // ── SUMMARY STATS ─────────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Summary', margin, y);
  y += 6;

  const total = complaints.length;
  const resolved = complaints.filter(c => c.status === 'resolved').length;
  const overdue = complaints.filter(c => c.status === 'overdue').length;
  const inProgress = complaints.filter(c => c.status === 'in_progress').length;
  const pending = complaints.filter(c => c.status === 'pending_validation').length;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // Draw 3 stat boxes
  const boxWidth = contentWidth / 3 - 3;
  const boxHeight = 20;
  const boxes = [
    { label: 'Total Complaints', value: String(total), color: [15, 23, 42] },
    { label: 'Resolved', value: `${resolved} (${resolutionRate}%)`, color: [22, 163, 74] },
    { label: 'Currently Overdue', value: String(overdue), color: overdue > 0 ? [220, 38, 38] : [15, 23, 42] },
  ];

  boxes.forEach((box, i) => {
    const x = margin + i * (boxWidth + 4.5);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text(box.label.toUpperCase(), x + 4, y + 6);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...box.color);
    doc.text(box.value, x + 4, y + 15);
  });

  y += boxHeight + 10;

  // Second row of stats
  const stats2 = [
    { label: 'In Progress', value: String(inProgress) },
    { label: 'Pending Validation', value: String(pending) },
    { label: 'Ever Escalated', value: String(escalationStats?.escalatedComplaints || 0) },
  ];

  stats2.forEach((stat, i) => {
    const x = margin + i * (boxWidth + 4.5);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text(stat.label.toUpperCase(), x + 4, y + 6);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(stat.value, x + 4, y + 15);
  });

  y += boxHeight + 10;

  // ── CATEGORY BREAKDOWN ────────────────────────────────────────────────────
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Complaints by Category', margin, y);
  y += 6;

  // Count by category
  const byCategory = {};
  complaints.forEach(c => {
    const label = CATEGORY_LABELS[c.category] || c.category;
    byCategory[label] = (byCategory[label] || 0) + 1;
  });

  const sortedCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1]);

  const maxCount = sortedCategories[0]?.[1] || 1;
  const barMaxWidth = contentWidth - 60;

  sortedCategories.forEach(([label, count]) => {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(label, margin, y + 3);

    // Bar
    const barWidth = (count / maxCount) * barMaxWidth;
    doc.setFillColor(59, 130, 246); // blue-500
    doc.roundedRect(margin + 50, y - 1, barWidth, 5, 1, 1, 'F');

    // Count label
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(String(count), margin + 50 + barWidth + 2, y + 3);

    y += 9;
  });

  y += 4;

  // ── STATUS BREAKDOWN ──────────────────────────────────────────────────────
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Complaints by Status', margin, y);
  y += 6;

  const byStatus = {};
  complaints.forEach(c => {
    const label = STATUS_LABELS[c.status] || c.status;
    byStatus[label] = (byStatus[label] || 0) + 1;
  });

  const sortedStatuses = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
  const maxStatusCount = sortedStatuses[0]?.[1] || 1;

  sortedStatuses.forEach(([label, count]) => {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(label, margin, y + 3);

    const barWidth = (count / maxStatusCount) * barMaxWidth;
    doc.setFillColor(99, 102, 241); // indigo-500
    doc.roundedRect(margin + 50, y - 1, barWidth, 5, 1, 1, 'F');

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(String(count), margin + 50 + barWidth + 2, y + 3);

    y += 9;
  });

  y += 4;

  // ── OFFICIALS CREDIBILITY ─────────────────────────────────────────────────
  if (escalationStats?.lowCredibilityOfficials?.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Officials with Low Credibility Score', margin, y);
    y += 6;

    // Table header
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text('OFFICIAL NAME', margin + 2, y + 5);
    doc.text('EMAIL', margin + 60, y + 5);
    doc.text('CREDIBILITY', pageWidth - margin - 2, y + 5, { align: 'right' });
    y += 9;

    escalationStats.lowCredibilityOfficials.forEach((official) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(official.name, margin + 2, y);
      doc.text(official.email, margin + 60, y);

      // Color code the score
      const score = official.credibilityScore;
      doc.setTextColor(score < 80 ? 220 : 217, score < 80 ? 38 : 119, score < 80 ? 38 : 6);
      doc.setFont('helvetica', 'bold');
      doc.text(String(score), pageWidth - margin - 2, y, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 8;
    });

    y += 4;
  }

  // ── RECURRING ISSUES ──────────────────────────────────────────────────────
  if (recurringIssues?.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Recurring Issues — Structural Problems Detected', margin, y);
    y += 6;

    recurringIssues.forEach((issue) => {
      if (y > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      const label = CATEGORY_LABELS[issue._id?.category] || issue._id?.category || 'Unknown';
      doc.text(`${label} — ${issue.count}× reported`, margin, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(issue.sampleAddress || 'Location unavailable', margin, y + 4);
      doc.text(
        `First: ${formatDate(issue.firstReported)} · Last: ${formatDate(issue.lastReported)}`,
        margin, y + 8
      );
      y += 13;
    });
  }

  // ── OVERDUE COMPLAINTS LIST ───────────────────────────────────────────────
  const overdueComplaints = complaints.filter(c => c.status === 'overdue');
  if (overdueComplaints.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`Overdue Complaints (${overdueComplaints.length})`, margin, y);
    y += 6;

    // Table header
    doc.setFillColor(254, 242, 242);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184);
    doc.text('TITLE', margin + 2, y + 5);
    doc.text('CATEGORY', margin + 80, y + 5);
    doc.text('FILED', pageWidth - margin - 2, y + 5, { align: 'right' });
    y += 9;

    overdueComplaints.forEach((complaint) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      const titleTrunc = complaint.title?.length > 40
        ? complaint.title.substring(0, 40) + '...'
        : complaint.title;

      doc.text(titleTrunc || 'Untitled', margin + 2, y);
      doc.text(
        CATEGORY_LABELS[complaint.category] || complaint.category || '',
        margin + 80, y
      );
      doc.text(
        formatDate(complaint.createdAt),
        pageWidth - margin - 2, y,
        { align: 'right' }
      );

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 8;
    });
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      'CivicPulse — Tamil Nadu Civic Accountability Platform — Confidential',
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
  const filename = `civicpulse-analytics-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};