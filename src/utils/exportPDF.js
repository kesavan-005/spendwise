import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

export async function exportSpendWisePDF({
  username = "User",
  totals,
  transactions,
  chartElementId = "report-pdf-charts",
}) {
  const doc = new jsPDF("p", "mm", "a4");

  doc.setFont("helvetica", "normal");

  // Title
  doc.setFontSize(18);
  doc.text("SpendWise Report", 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`Generated for: ${username}`, 14, 25);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 31);
  doc.setTextColor(0);

  // Summary
  doc.setFontSize(14);
  doc.text("Summary", 14, 42);

  doc.setFontSize(12);
  doc.text(`Total Credit: Rs. ${totals.credit.toFixed(0)}`, 14, 50);
  doc.text(`Total Debit: Rs. ${totals.debit.toFixed(0)}`, 14, 57);
  doc.text(`Balance: Rs. ${totals.balance.toFixed(0)}`, 14, 64);

  // Charts section
  let currentY = 72;
  const chartEl = document.getElementById(chartElementId);

  if (chartEl) {
    doc.setFontSize(14);
    doc.text("Graphs", 14, currentY);
    currentY += 6;

    const canvas = await html2canvas(chartEl, {
      backgroundColor: "#ffffff",   // ✅ clean white
      scale: 2,
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");

    const pageWidth = doc.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 28;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    doc.addImage(imgData, "PNG", 14, currentY, imgWidth, imgHeight);
    currentY += imgHeight + 10;
  }

  // Transactions
  doc.setFontSize(14);
  doc.text("Transactions", 14, currentY);

  const rows = transactions.map((t) => [
    t.date,
    (t.type || "").toUpperCase(),
    t.category,
    t.description,
    `Rs. ${t.amount}`,
  ]);

  autoTable(doc, {
    startY: currentY + 5,
    head: [["Date", "Type", "Category", "Description", "Amount"]],
    body: rows,
    styles: {
      font: "helvetica",
      fontSize: 10,
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [16, 185, 129],
      textColor: 0,
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`SpendWise_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
