'use strict';  
angular
  .module('carRentalApp')
  .service('SellerDashboardService', SellerDashboardService);

SellerDashboardService.$inject = ['$q', 'DbService', 'AuthService', 'MessagingService', 'BiddingService', 'BookingService', '$http', 'BiddingFactory'];

function SellerDashboardService($q, DbService, AuthService, MessagingService, BiddingService, BookingService, $http, BiddingFactory) {
  // Define API_BASE_URL constant
  const API_BASE_URL = 'http://localhost:5050/api/v1';

  const service = {
    loadBids: loadBids,
    updateBidStatus: updateBidStatus
  };
  
  return service;
  
  /**
   * Loads bids for the seller with optional status filter
   * @param {string} status - Optional status filter
   * @returns {Promise<Array>} Promise resolving with filtered bids
   */
  function loadBids(status) {
    console.log('Loading bids with status:', status);
    
    // Ensure status is lowercase to match backend enum values
    const normalizedStatus = status ? status.toLowerCase() : status;
    
    // Use the new BiddingService.loadSellerBids method
    return BiddingService.loadSellerBids(normalizedStatus)
      .then(function(bidsData) {
        console.log("Bids data loaded successfully using BiddingService:", bidsData);
        
        // Create Bidding objects using factory
        const bidObjects = BiddingFactory.createBiddingArray(bidsData);
        console.log("Created bid objects using factory:", bidObjects);
        
        return bidObjects;
      })
      .catch(function(error) {
        console.error("Error loading bids:", error);
        return $q.reject(error);
      });
  }
  
  /**
   * Update bid status (accept/reject)
   * @param {string} bidId - The bid ID to update
   * @param {string} status - The new status ('accepted' or 'rejected')
   * @param {string} customMessage - Optional custom message to send to bidder
   * @returns {Promise} Promise resolving when bid status is updated
   */
  function updateBidStatus(bidId, status, customMessage) {
    const user = AuthService.getLoggedInUser();
    if (!bidId) {
      console.error("Error: Missing bid ID when trying to update bid status to", status);
      return $q.reject("Missing bid ID");
    }
    
    console.log("Updating bid status:", bidId, "to", status);
    
    // Use the respondToBid method from BiddingService
    return BiddingService.respondToBid(bidId, status, customMessage)
      .then(function(updatedBidData) {
        console.log("Bid status updated successfully:", status);
        
        // Create a Bidding object from the updated data
        const updatedBid = BiddingFactory.createBidding(updatedBidData);
        console.log("Created updated bid object using factory:", updatedBid);
        
        // Get the bid details to find the conversation
        return BiddingService.getBidById(bidId)
          .then(function(bidDetailsData) {
            if (!bidDetailsData) {
              console.warn('Could not find bid details for messaging');
              return updatedBid;
            }
            
            // Create a Bidding object for detailed bid data
            const bidDetails = BiddingFactory.createBidding(bidDetailsData);
            console.log("Created bid details object using factory:", bidDetails);
            
            // Find or create conversation between seller and bidder
            return BiddingService.createConversationIfNotExists(
              bidDetails.vehicle,
              user._id,
              bidDetails.bidder._id || bidDetails.bidder
            )
            .then(function(conversationId) {
              if (!conversationId) {
                console.warn('Could not create or find conversation');
                return updatedBid;
              }
              
              // Format the status message using Bidding object methods
              const statusMessage = status === 'accepted' ?
                `I have accepted your bid of ${updatedBid.getFormattedAmount()} for ${bidDetails.vehicle_details?.title || 'the vehicle'}.` :
                `I have rejected your bid of ${updatedBid.getFormattedAmount()} for ${bidDetails.vehicle_details?.title || 'the vehicle'}.`;
                
              const message = customMessage ? 
                `${statusMessage}\n\n${customMessage}` : 
                statusMessage;
                
              // Send the message
              return MessagingService.sendMessage(conversationId, message)
                .then(function() {
                  return updatedBid;
                })
                .catch(function(err) {
                  console.error('Error sending bid status message:', err);
                  return updatedBid; // Still return the bid even if messaging fails
                });
            });
          })
          .catch(function(err) {
            console.error('Error getting bid details for messaging:', err);
            return updatedBid; // Still return the bid even if getting details fails
          });
      })
      .catch(function(error) {
        console.error(`Error ${status === 'accepted' ? 'accepting' : 'rejecting'} bid:`, error);
        return $q.reject(error.data?.message || error.statusText || `Failed to ${status === 'accepted' ? 'accept' : 'reject'} bid`);
      });
  }
}
