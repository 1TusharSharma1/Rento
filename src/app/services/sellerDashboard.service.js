'use strict';  
  angular
    .module('carRentalApp')
    .service('SellerDashboardService', SellerDashboardService);
  
  SellerDashboardService.$inject = ['$q', 'DbService', 'AuthService', 'MessagingService'];
  
  function SellerDashboardService($q, DbService, AuthService, MessagingService) {

    const service = {
      loadBids: loadBids,
      updateBidStatus: updateBidStatus
    };
    
    return service;
    
    /**
     * Loads all bids for the logged-in seller filtered by the provided status.
     * Uses IndexedDB via the "seller_id" index to fetch relevant bids.
     */
    function loadBids(status) {
      console.log('Loading bids with status:', status);
      const seller = AuthService.getLoggedInUser();
      
      if (!seller) {
        console.error('No seller logged in');
        return $q.reject("No seller logged in");
      }
    
      return DbService.getStore('bidding', 'readonly')
        .then(function(store) {
          return new Promise(function(resolve, reject) {
            const request = store.getAll();
            
            request.onsuccess = function(event) {
              const allBids = event.target.result || [];
              console.log('Total bids in database:', allBids.length);
              
              // Filter bids for this seller
              const sellerBids = allBids.filter(function(bid) {
                return bid.seller && 
                       String(bid.seller.user_id) === String(seller.user_id);
              });
              
              // Apply status filter if provided
              const filteredBids = status ? 
                sellerBids.filter(function(bid) {
                  return String(bid.bid_status).toLowerCase() === String(status).toLowerCase();
                }) : 
                sellerBids;
              
              console.log('Final filtered bids:', filteredBids.length);
              resolve(filteredBids);
            };
            
            request.onerror = function(event) {
              reject(event.target.error);
            };
          });
        });
    }
    
    /**
     * Updates a bid's status and handles related actions
     * For "Accepted" bids: creates booking and rejects overlapping bids
     * For "Rejected" bids: simply updates status
     * Sends appropriate notification messages to the bidder in both cases
     */
    function updateBidStatus(bidId, newStatus) {
      return DbService.getRecord('bidding', bidId)
        .then(function(bid) {
          if (!bid) {
            throw new Error('Bid not found');
          }
          
          bid.bid_status = newStatus;
          const conversationId = [bid.bidder.user_id, bid.seller.user_id].sort().join('_');
          const statusMessage = newStatus === 'Accepted' 
            ? `Your bid for ${bid.vehicle.name} has been accepted!\nAmount: Rs ${bid.bid_amount}\nDuration: ${bid.booking_start_date} to ${bid.booking_end_date}`
            : `Your bid for ${bid.vehicle.name} has been rejected.`;
          
          if (newStatus === 'Accepted') {
            return autoRejectOverlappingBids(bid)
              .then(function() {
                return createBooking(bid);
              })
              .then(function() {
                return $q.all([
                  DbService.updateRecord('bidding', bid),
                  MessagingService.sendMessage(
                    conversationId,
                    statusMessage,
                    null
                  )
                ]);
              });
          }
          
          return $q.all([
            DbService.updateRecord('bidding', bid),
            MessagingService.sendMessage(
              conversationId,
              statusMessage,
              null
            )
          ]);
        });
    }
    
    /**
     * Creates a booking record in the database based on accepted bid details
     */
    function createBooking(bid) {
      const bookingData = {
        booking_id: crypto.randomUUID(),
        bid_id: bid.bid_id,
        vehicle: bid.vehicle,
        renter: bid.bidder,
        seller: bid.seller,
        booking_amount: bid.bid_amount,
        booking_start_date: bid.booking_start_date,
        booking_end_date: bid.booking_end_date,
        booking_date: new Date().toISOString(),
        status: 'Confirmed',
        isOutstation: bid.isOutstation
      };

      return DbService.addRecord('bookings', bookingData);
    }
    
    /**
     * Finds and rejects all active bids for the same vehicle with overlapping dates
     * Prevents double-booking by automatically rejecting conflicting bids
     */
    function autoRejectOverlappingBids(acceptedBid) {
      return DbService.getStore('bidding', 'readwrite')
        .then(function(store) {
          return new Promise(function(resolve, reject) {
            const request = store.getAll();
            request.onsuccess = function(event) {
              const bids = event.target.result;
              const updatePromises = bids
                .filter(function(bid) {
                  // Filter for active bids on same vehicle with date overlap
                  return bid.bid_id !== acceptedBid.bid_id &&
                         bid.bid_status === 'Active' &&
                         bid.vehicle &&
                         bid.vehicle.vehicle_id === acceptedBid.vehicle.vehicle_id &&
                         isOverlap(
                           acceptedBid.booking_start_date,
                           acceptedBid.booking_end_date,
                           bid.booking_start_date,
                           bid.booking_end_date
                         );
                })
                .map(function(bid) {
                  bid.bid_status = 'Rejected';
                  return DbService.updateRecord('bidding', bid);
                });
              
              Promise.all(updatePromises)
                .then(resolve)
                .catch(reject);
            };
            request.onerror = function(event) {
              reject(event.target.error);
            };
          });
        });
    }
     
    /**
     * Helper function to determine if two date ranges overlap
     * Returns true if there's any overlap between the ranges
     */
    function isOverlap(start1, end1, start2, end2) {
      const s1 = new Date(start1).getTime(),
            e1 = new Date(end1).getTime(),
            s2 = new Date(start2).getTime(),
            e2 = new Date(end2).getTime();
      return s1 < e2 && s2 < e1;
    }
  }
