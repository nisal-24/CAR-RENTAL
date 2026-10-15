module.exports = {
  VEHICLE_TYPES: ['Sedan', 'Hatchback', 'SUV', 'Van', 'Pickup', 'Luxury'],
  VEHICLE_STATUS: ['Available', 'Maintenance', 'Retired'],
  RENTAL_STATUS: ['Pending', 'Confirmed', 'Active', 'Completed', 'Cancelled'],
  PAYMENT_STATUS: ['Pending', 'Paid', 'Refunded', 'Cancelled'],
  PAYMENT_METHODS: ['Card', 'Bank Transfer', 'Cash'],
  // Rentals in these states block a vehicle for their date range
  BLOCKING_STATUS: ['Pending', 'Confirmed', 'Active'],
  MAX_RENTAL_DAYS: 60,
};
