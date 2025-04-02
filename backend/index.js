import dotenv from "dotenv";
import connectToDB from "./db/index.js";
import server from "./app.js";
// Loading environment variables
dotenv.config();

// Connect to the database
connectToDB().then(()=>{
    // Start the server
    const PORT = process.env.PORT || 5050;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch((err) => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
});