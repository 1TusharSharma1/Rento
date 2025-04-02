import mongoose from 'mongoose';
import { DB_NAME } from '../contstants.js';
import ApiError from '../utils/ApiError.js';

const connectToDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
        console.log(`Connected to DB: ${connectionInstance.connection.name}`);
    }
    catch (error) {
        console.error('MongoDB connection error:', error);
        throw new ApiError(
            500,
            'Database connection failed',
            [error.message]
        );
    }
}

export default connectToDB;