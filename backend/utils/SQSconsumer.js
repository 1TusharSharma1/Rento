import { Bidding } from "../models/booking.model.js";
import { SQS } from '@aws-sdk/client-sqs';
import dotenv from 'dotenv';

dotenv.config();

async function awsSQSConsumer() {
    const sqs = new SQS({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    });
    
    try {
        const { Messages } = await sqs.receiveMessage({
            QueueUrl: process.env.biddingQueue_URI,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20
        });
        
        if (!Messages) return;
        
        console.log("Received message from SQS queue:");
        const parsedMessage = JSON.parse(Messages[0].Body);
        console.log(parsedMessage);
        const bidData = parsedMessage._doc || parsedMessage;
        console.log("Extracted bid data:", bidData);
        
        // Create a new bid with the extracted data
        await new Bidding(bidData).save();
        console.log("Bid saved successfully");
        
        const deleteParams = {
            QueueUrl: process.env.biddingQueue_URI,
            ReceiptHandle: Messages[0].ReceiptHandle,
        };
        
        await sqs.deleteMessage(deleteParams);
        console.log("Message processed and deleted from queue");
    } catch (error) {
        console.error('Error processing SQS message:', error);
    }
}

export default awsSQSConsumer;









