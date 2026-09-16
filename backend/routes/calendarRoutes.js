const express = require('express');
const router = express.Router();
const { getCalendarEvents, completeCalendarEvent, deleteCalendarEvent } = require('../controllers/calendarController');

router.get('/events', getCalendarEvents);
router.patch('/events/:module/:id/complete', completeCalendarEvent);
router.delete('/events/:module/:id', deleteCalendarEvent);

module.exports = router;
