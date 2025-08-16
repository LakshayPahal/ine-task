const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('SendGrid email service initialized');
} else {
  console.log('SendGrid API key not found, email service disabled');
}

async function sendEmail(to, subject, text, html = null, attachments = []) {
  // Security: Validate email address format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    throw new Error(`Invalid email address format: ${to}`);
  }
  
  // Security: Sanitize email content
  const sanitizedSubject = subject.substring(0, 200); // Limit subject length
  const sanitizedText = text.substring(0, 10000); // Limit text length
  
  console.log(`📧 Attempting to send email to: ${to.substring(0, 3)}***@${to.split('@')[1]}`);
  
  if (!process.env.SENDGRID_API_KEY) {
    console.log('📧 [EMAIL SIMULATION]');
    console.log(`To: ${to.substring(0, 3)}***@${to.split('@')[1]}`);
    console.log(`Subject: ${sanitizedSubject}`);
    console.log(`Text: ${sanitizedText.substring(0, 100)}...`);
    if (attachments.length > 0) {
      console.log(`Attachments: ${attachments.map(a => a.filename).join(', ')}`);
    }
    console.log('📧 [END EMAIL SIMULATION]');
    return { success: true, simulation: true };
  }

  try {
    const msg = {
      to,
      from: process.env.SENDGRID_FROM || 'no-reply@auctionapp.com',
      subject: sanitizedSubject,
      text: sanitizedText,
      html: html || sanitizedText,
      attachments
    };

    const result = await sgMail.send(msg);
    console.log(`Email sent successfully to ${to}`);
    return { success: true, messageId: result[0].headers['x-message-id'] };

  } catch (error) {
    console.error('Failed to send email:', error.message);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Development mode: continuing despite email failure');
      return { success: false, error: error.message, simulation: true };
    }
    
    throw error;
  }
}

async function sendBidAcceptedEmail(buyer, auction, amount, invoiceBuffer = null) {
  const subject = `Your bid was accepted for "${auction.title}"`;
  
  const text = `
Congratulations! Your bid has been accepted!

Auction: ${auction.title}
Your winning bid: ₹${amount}
Seller: ${auction.seller?.displayName || 'Auction Seller'}

Thank you for using our auction platform!

Best regards,
The Auction Team
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #28a745;">Congratulations!</h1>
      <p>Your bid has been <strong>accepted</strong>!</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Auction Details</h3>
        <p><strong>Item:</strong> ${auction.title}</p>
        <p><strong>Your winning bid:</strong> ₹${amount}</p>
        <p><strong>Seller:</strong> ${auction.seller?.displayName || 'Auction Seller'}</p>
      </div>
      
      <p>Thank you for using our auction platform!</p>
      <p>Best regards,<br>The Auction Team</p>
    </div>
  `;

  const attachments = [];
  if (invoiceBuffer) {
    attachments.push({
      filename: `invoice-${auction.id}.pdf`,
      content: invoiceBuffer.toString('base64'),
      type: 'application/pdf',
      disposition: 'attachment'
    });
  }

  return await sendEmail(buyer.email, subject, text, html, attachments);
}

async function sendBidAcceptedSellerEmail(seller, auction, amount, buyerName, invoiceBuffer = null) {
  const subject = `You accepted a bid for "${auction.title}"`;
  
  const text = `
You have successfully accepted a bid!

Auction: ${auction.title}
Accepted bid: ₹${amount}
Buyer: ${buyerName}

Thank you for using our auction platform!

Best regards,
The Auction Team
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #007bff;">Bid Accepted</h1>
      <p>You have successfully <strong>accepted</strong> a bid!</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Transaction Details</h3>
        <p><strong>Item:</strong> ${auction.title}</p>
        <p><strong>Accepted bid:</strong> ₹${amount}</p>
        <p><strong>Buyer:</strong> ${buyerName}</p>
      </div>
      
      <p>Thank you for using our auction platform!</p>
      <p>Best regards,<br>The Auction Team</p>
    </div>
  `;

  const attachments = [];
  if (invoiceBuffer) {
    attachments.push({
      filename: `invoice-${auction.id}.pdf`,
      content: invoiceBuffer.toString('base64'),
      type: 'application/pdf',
      disposition: 'attachment'
    });
  }

  return await sendEmail(seller.email, subject, text, html, attachments);
}
  
async function sendBidRejectedEmail(buyer, auction, amount) {
  const subject = `Your bid was not accepted for "${auction.title}"`;
  
  const text = `
We're sorry to inform you that your bid was not accepted.

Auction: ${auction.title}
Your bid: ₹${amount}

Don't worry - there are many other great auctions available on our platform!

Best regards,
The Auction Team
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #dc3545;">Bid Not Accepted</h1>
      <p>We're sorry to inform you that your bid was <strong>not accepted</strong>.</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Auction Details</h3>
        <p><strong>Item:</strong> ${auction.title}</p>
        <p><strong>Your bid:</strong> ₹${amount}</p>
      </div>
      
      <p>Don't worry - there are many other great auctions available on our platform!</p>
      <p>Best regards,<br>The Auction Team</p>
    </div>
  `;

  return await sendEmail(buyer.email, subject, text, html);
}

async function sendCounterOfferEmail(buyer, auction, originalBid, counterOfferAmount) {
  const subject = `Counter offer received for "${auction.title}"`;
  
  const text = `
  You've received a counter offer!

  Auction: ${auction.title}
  Your original bid: ₹${originalBid}
  Seller's counter offer: ₹${counterOfferAmount}
  Seller: ${auction.seller?.displayName || 'Auction Seller'}

  The seller has proposed a different price for this item. You have 24 hours to accept or reject this counter offer.

  To respond to this counter offer, please visit the auction page and make your decision.

  Best regards,
  The Auction Team
    `.trim();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #007bff;">Counter Offer Received!</h1>
        <p>The seller has made a <strong>counter offer</strong> for your bid!</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Offer Details</h3>
          <p><strong>Item:</strong> ${auction.title}</p>
          <p><strong>Your original bid:</strong> ₹${originalBid.toLocaleString('en-IN')}</p>
          <p><strong>Seller's counter offer:</strong> <span style="color: #007bff; font-size: 1.2em;">₹${counterOfferAmount.toLocaleString('en-IN')}</span></p>
          <p><strong>Seller:</strong> ${auction.seller?.displayName || 'Auction Seller'}</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 10px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0;"><strong>⏰ Time Limit:</strong> You have 24 hours to accept or reject this counter offer.</p>
        </div>
        
        <p>To respond to this counter offer, please visit the auction page and make your decision.</p>
        <p>Best regards,<br>The Auction Team</p>
      </div>
    `;

  return await sendEmail(buyer.email, subject, text, html);
}

async function sendCounterOfferRejectedEmail(buyer, auction, counterOfferAmount) {
  const subject = `Counter offer confirmation for "${auction.title}"`;
  
  const text = `
  Counter offer rejected.

  Auction: ${auction.title}
  Rejected counter offer: ₹${counterOfferAmount}
  Seller: ${auction.seller?.displayName || 'Auction Seller'}

  You have rejected the seller's counter offer. The auction has ended without a sale.

  Thank you for participating in our auction platform!

  Best regards,
  The Auction Team
    `.trim();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6c757d;">Counter Offer Rejected</h1>
        <p>You have <strong>rejected</strong> the seller's counter offer.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Rejection Details</h3>
          <p><strong>Item:</strong> ${auction.title}</p>
          <p><strong>Rejected counter offer:</strong> ₹${counterOfferAmount.toLocaleString('en-IN')}</p>
          <p><strong>Seller:</strong> ${auction.seller?.displayName || 'Auction Seller'}</p>
        </div>
        
        <p>The auction has ended without a sale. Thank you for participating!</p>
        <p>Best regards,<br>The Auction Team</p>
      </div>
    `;

  return await sendEmail(buyer.email, subject, text, html);
}

module.exports = {
  sendEmail,
  sendBidAcceptedEmail,
  sendBidAcceptedSellerEmail,
  sendBidRejectedEmail,
  sendCounterOfferEmail,
  sendCounterOfferRejectedEmail
};