const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function generateInvoice({ auction, buyer, seller, amount, bidId = null }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Invoice - ${auction.title}`,
          Author: 'Auction Platform',
          Subject: 'Auction Invoice',
          Creator: 'Auction Platform',
          Producer: 'Auction Platform'
        }
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      doc.on('error', reject);

      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text('AUCTION INVOICE', { align: 'center' });

      doc.moveDown(0.5);

      doc.fontSize(10)
         .font('Helvetica')
         .text(`Invoice Date: ${new Date().toLocaleDateString()}`, { align: 'right' })
         .text(`Invoice ID: INV-${auction.id}`, { align: 'right' });

      if (bidId) {
        doc.text(`Bid ID: ${bidId}`, { align: 'right' });
      }

      doc.moveDown(1);

      doc.strokeColor('#007bff')
         .lineWidth(2)
         .moveTo(50, doc.y)
         .lineTo(545, doc.y)
         .stroke();

      doc.moveDown(1);

      const leftColumn = 50;
      const rightColumn = 300;
      const startY = doc.y;

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('BUYER INFORMATION:', leftColumn, startY);

      doc.fontSize(10)
         .font('Helvetica')
         .text(`Name: ${buyer.displayName}`, leftColumn, doc.y + 5)
         .text(`Email: ${buyer.email}`, leftColumn, doc.y + 5);

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('SELLER INFORMATION:', rightColumn, startY);

      doc.fontSize(10)
         .font('Helvetica')
         .text(`Name: ${seller.displayName}`, rightColumn, startY + 17)
         .text(`Email: ${seller.email}`, rightColumn, startY + 32);

      doc.moveDown(2);

      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('AUCTION DETAILS', 50);

      doc.moveDown(0.5);

      const boxY = doc.y;
      doc.rect(50, boxY, 495, 80)
         .fillAndStroke('#f8f9fa', '#dee2e6');

      doc.fontSize(11)
         .fillColor('#000')
         .font('Helvetica-Bold')
         .text('Item:', 60, boxY + 15)
         .font('Helvetica')
         .text(auction.title, 100, boxY + 15);

      doc.font('Helvetica-Bold')
         .text('Description:', 60, boxY + 35)
         .font('Helvetica')
         .text(auction.description || 'No description provided', 130, boxY + 35, { 
           width: 400, 
           height: 30 
         });

      doc.y = boxY + 85;
      doc.moveDown(1);

      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('PAYMENT DETAILS', 50);

      doc.moveDown(0.5);

      const tableY = doc.y;
      const rowHeight = 25;

      doc.rect(50, tableY, 495, rowHeight)
         .fillAndStroke('#007bff', '#007bff');

      doc.fontSize(11)
         .fillColor('#fff')
         .font('Helvetica-Bold')
         .text('Description', 60, tableY + 8)
         .text('Amount', 450, tableY + 8);

      doc.rect(50, tableY + rowHeight, 495, rowHeight)
         .fillAndStroke('#fff', '#dee2e6');

      doc.fillColor('#000')
         .font('Helvetica')
         .text('Winning Bid Amount', 60, tableY + rowHeight + 8)
         .font('Helvetica-Bold')
         .text(`₹${Number(amount).toLocaleString('en-IN')}`, 450, tableY + rowHeight + 8);

      doc.rect(50, tableY + (2 * rowHeight), 495, rowHeight)
         .fillAndStroke('#28a745', '#28a745');

      doc.fontSize(12)
         .fillColor('#fff')
         .font('Helvetica-Bold')
         .text('TOTAL AMOUNT', 60, tableY + (2 * rowHeight) + 8)
         .text(`₹${Number(amount).toLocaleString('en-IN')}`, 450, tableY + (2 * rowHeight) + 8);

      doc.y = tableY + (3 * rowHeight) + 20;

      doc.fontSize(10)
         .fillColor('#666')
         .font('Helvetica')
         .text('Terms & Conditions:', 50, doc.y + 20)
         .text('• This invoice serves as confirmation of the accepted bid.', 50, doc.y + 5)
         .text('• Payment terms and delivery arrangements to be coordinated between buyer and seller.', 50, doc.y + 5)
         .text('• All transactions are subject to our platform terms of service.', 50, doc.y + 5);

      doc.fontSize(8)
         .fillColor('#999')
         .text(`Generated on ${new Date().toLocaleString()} by Auction Platform`, 50, 750, { 
           align: 'center' 
         });

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

async function generateInvoiceFile(options) {
  const buffer = await generateInvoice(options);
  const fileName = `invoice-${options.auction.id}-${Date.now()}.pdf`;
  const filePath = path.join('/tmp', fileName);
  
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function cleanupOldInvoices() {
  const tmpDir = '/tmp';
  const files = fs.readdirSync(tmpDir);
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  files.forEach(file => {
    if (file.startsWith('invoice-') && file.endsWith('.pdf')) {
      const filePath = path.join(tmpDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > oneDay) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up old invoice: ${file}`);
      }
    }
  });
}

module.exports = {
  generateInvoice,
  generateInvoiceFile,
  cleanupOldInvoices
};