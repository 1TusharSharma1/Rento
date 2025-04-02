import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send welcome email to newly registered user
 * @param {Object} user - User object containing name and email
 * @returns {Promise<Object>} - Nodemailer send response
 */
export const sendWelcomeEmail = async (user) => {
  const { name, email } = user;
  
  const mailOptions = {
    from: `"RentO Car Rental" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to RentO Car Rental Service!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #4285f4;">Welcome to RentO Car Rental!</h1>
        </div>
        <div style="padding: 20px 0;">
          <p>Hello ${name},</p>
          <p>Thank you for joining RentO - your premier destination for car rentals. We're excited to have you onboard!</p>
          <p>With your new account, you can:</p>
          <ul>
            <li>Browse our extensive collection of vehicles</li>
            <li>Place bids on your favorite cars</li>
            <li>Track your bookings</li>
            <li>Communicate with vehicle owners</li>
          </ul>
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          <p>Happy renting!</p>
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #757575; font-size: 12px;">
          <p>This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return null;
  }
};

/**
 * Send bid notification email to the seller
 * @param {Object} bid - Bid object containing vehicle details, bidder info, and seller info
 * @returns {Promise<Object>} - Nodemailer send response
 */
export const sendBidNotificationToSeller = async (bid) => {
  const {
    vehicle_details,
    bidder,
    seller,
    bid_amount,
    booking_start_date,
    booking_end_date,
    is_outstation
  } = bid;
  
  const startDate = new Date(booking_start_date).toLocaleDateString();
  const endDate = new Date(booking_end_date).toLocaleDateString();
  
  const mailOptions = {
    from: `"RentO Car Rental" <${process.env.EMAIL_USER}>`,
    to: seller.email,
    subject: `New Bid Received for ${vehicle_details.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #4285f4;">New Bid Notification</h1>
        </div>
        <div style="padding: 20px 0;">
          <p>Hello ${seller.name},</p>
          <p>You've received a new bid for your car: <strong>${vehicle_details.title}</strong></p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3>Bid Details:</h3>
            <p><strong>Bidder Name:</strong> ${bidder.name}</p>
            <p><strong>Bid Amount:</strong> Rs. ${bid_amount}</p>
            <p><strong>Rental Period:</strong> ${startDate} to ${endDate}</p>
            <p><strong>Type:</strong> ${is_outstation ? 'Outstation' : 'Local'}</p>
          </div>
          <p>Please log in to your dashboard to review and respond to this bid.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/seller/dashboard" style="background-color: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a>
          </div>
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #757575; font-size: 12px;">
          <p>This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Bid notification email sent to seller:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending bid notification email to seller:', error);
    return null;
  }
};

/**
 * Send bid confirmation email to the bidder
 * @param {Object} bid - Bid object containing vehicle details, bidder info, etc.
 * @returns {Promise<Object>} - Nodemailer send response
 */
export const sendBidConfirmationToBidder = async (bid) => {
  const {
    vehicle_details,
    bidder,
    bid_amount,
    booking_start_date,
    booking_end_date,
    is_outstation
  } = bid;
  
  const startDate = new Date(booking_start_date).toLocaleDateString();
  const endDate = new Date(booking_end_date).toLocaleDateString();
  
  const mailOptions = {
    from: `"RentO Car Rental" <${process.env.EMAIL_USER}>`,
    to: bidder.email,
    subject: `Your Bid for ${vehicle_details.title} has been placed`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #4285f4;">Bid Confirmation</h1>
        </div>
        <div style="padding: 20px 0;">
          <p>Hello ${bidder.name},</p>
          <p>Your bid for <strong>${vehicle_details.title}</strong> has been successfully placed!</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3>Bid Details:</h3>
            <p><strong>Bid Amount:</strong> Rs. ${bid_amount}</p>
            <p><strong>Rental Period:</strong> ${startDate} to ${endDate}</p>
            <p><strong>Type:</strong> ${is_outstation ? 'Outstation' : 'Local'}</p>
          </div>
          <p>The vehicle owner will review your bid shortly. You'll receive another notification once they respond.</p>
          <p>You can check the status of your bid in your dashboard.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/buyer/bookings" style="background-color: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View My Bids</a>
          </div>
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #757575; font-size: 12px;">
          <p>This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Bid confirmation email sent to bidder:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending bid confirmation email to bidder:', error);
    return null;
  }
};

/**
 * Send booking confirmation emails to both seller and renter
 * @param {Object} booking - Booking object containing vehicle details, renter info, seller info
 * @returns {Promise<Array>} - Array of nodemailer send responses
 */
export const sendBookingConfirmationEmails = async (booking) => {
  const {
    vehicle_details,
    renter,
    seller,
    booking_start_date,
    booking_end_date,
    total_price,
    is_outstation
  } = booking;
  
  const startDate = new Date(booking_start_date).toLocaleDateString();
  const endDate = new Date(booking_end_date).toLocaleDateString();
  
  // Email to seller
  const sellerMailOptions = {
    from: `"RentO Car Rental" <${process.env.EMAIL_USER}>`,
    to: seller.email,
    subject: `Booking Confirmed for ${vehicle_details.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #4285f4;">Booking Confirmed!</h1>
        </div>
        <div style="padding: 20px 0;">
          <p>Hello ${seller.name},</p>
          <p>Congratulations! A bid for your <strong>${vehicle_details.title}</strong> has been converted to a booking.</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3>Booking Details:</h3>
            <p><strong>Renter:</strong> ${renter.name}</p>
            <p><strong>Rental Period:</strong> ${startDate} to ${endDate}</p>
            <p><strong>Total Amount:</strong> Rs. ${total_price}</p>
            <p><strong>Type:</strong> ${is_outstation ? 'Outstation' : 'Local'}</p>
          </div>
          <p>Please prepare your vehicle for the scheduled rental period. You can view the complete booking details in your dashboard.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/seller/bookings" style="background-color: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Bookings</a>
          </div>
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #757575; font-size: 12px;">
          <p>This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    `
  };
  
  // Email to renter
  const renterMailOptions = {
    from: `"RentO Car Rental" <${process.env.EMAIL_USER}>`,
    to: renter.email,
    subject: `Your Booking for ${vehicle_details.title} is Confirmed`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #4285f4;">Booking Confirmed!</h1>
        </div>
        <div style="padding: 20px 0;">
          <p>Hello ${renter.name},</p>
          <p>Great news! Your booking for <strong>${vehicle_details.title}</strong> has been confirmed.</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3>Booking Details:</h3>
            <p><strong>Rental Period:</strong> ${startDate} to ${endDate}</p>
            <p><strong>Total Amount:</strong> Rs. ${total_price}</p>
            <p><strong>Type:</strong> ${is_outstation ? 'Outstation' : 'Local'}</p>
            <p><strong>Owner Contact:</strong> ${seller.phone || 'Available in your booking details'}</p>
          </div>
          <p>Please make sure to review the vehicle policies and be on time for your pickup. You can view your booking details and communicate with the owner through the dashboard.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/buyer/bookings" style="background-color: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View My Bookings</a>
          </div>
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #757575; font-size: 12px;">
          <p>This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    `
  };
  
  try {
    const sellerInfo = await transporter.sendMail(sellerMailOptions);
    console.log('Booking confirmation email sent to seller:', sellerInfo.messageId);
    
    const renterInfo = await transporter.sendMail(renterMailOptions);
    console.log('Booking confirmation email sent to renter:', renterInfo.messageId);
    
    return [sellerInfo, renterInfo];
  } catch (error) {
    console.error('Error sending booking confirmation emails:', error);
    return null;
  }
}; 