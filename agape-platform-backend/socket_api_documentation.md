# Agape Platform WebSocket API Documentation

This document outlines the WebSocket events and interactions available in the Agape Platform.

## Connection

Connect to the WebSocket server:

```javascript
const socket = io('https://api-domain.com', {
  transports: ['websocket'],
  upgrade: false,
  query: { token: 'your_authentication_token' }
});
```

## Authentication

Authentication is required to use the WebSocket features:

```javascript
// First obtain a socket token from the REST API
const response = await fetch('/api/auth/socket-token', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});
const { socket_token } = await response.json();

// Then authenticate with the WebSocket
socket.emit('authenticate', { token: socket_token });

// Handle authentication response
socket.on('authenticated', (data) => {
  console.log('Authenticated successfully', data);
  // data contains user_id, status, and unread_notifications
});

socket.on('authentication_error', (error) => {
  console.error('Authentication failed', error);
});
```

## User Status

```javascript
// Set your own status
socket.emit('set_status', {
  user_id: 'your_user_id',
  status: 'online' // or 'offline', 'away', 'busy', 'in_meeting'
});

// Get currently active users
socket.emit('get_active_users');
socket.on('active_users', (data) => {
  console.log('Active users:', data.users);
});

// Listen for status changes of other users
socket.on('user_status_change', (data) => {
  console.log(`User ${data.user_id} is now ${data.status}`);
});
```

## Messaging

```javascript
// Send a new message
socket.emit('new_message', {
  content: 'Hello everyone!',
  sender_id: 'your_user_id',
  recipient_type: 'ministry', // or 'camp', 'user'
  recipient_id: 'recipient_id', // required for camp or user messages
  is_announcement: false
});

// Listen for new messages
socket.on('new_message', (message) => {
  console.log('New message:', message);
});

// Mark a message as read
socket.emit('message_read', {
  message_id: 'the_message_id',
  user_id: 'your_user_id'
});

// Listen for read receipts
socket.on('message_read_status', (data) => {
  console.log(`Message ${data.message_id} was read by ${data.user_id}`);
});

// Indicate you're typing
socket.emit('typing', {
  user_id: 'your_user_id',
  conversation_type: 'camp', // or 'meeting', 'direct'
  conversation_id: 'camp_id' // or meeting_id, or user_id
});

// Listen for typing indicators
socket.on('user_typing', (data) => {
  console.log(`User ${data.user_id} is typing in ${data.conversation_type}`);
});
```

## Meetings

```javascript
// Join a meeting room
socket.emit('join_meeting', {
  meeting_id: 'the_meeting_id',
  user_id: 'your_user_id'
});

// Leave a meeting room
socket.emit('leave_meeting', {
  meeting_id: 'the_meeting_id',
  user_id: 'your_user_id'
});

// Send a message in a meeting
socket.emit('meeting_message', {
  meeting_id: 'the_meeting_id',
  user_id: 'your_user_id',
  content: 'Hello everyone in this meeting!'
});

// Listen for meeting messages
socket.on('new_meeting_message', (message) => {
  console.log('New meeting message:', message);
});

// Listen for user joining/leaving meetings
socket.on('user_joined_meeting', (data) => {
  console.log(`${data.user_name} joined the meeting`);
});

socket.on('user_left_meeting', (data) => {
  console.log(`User ${data.user_id} left the meeting`);
});

// Start a meeting (hosts/admins only)
socket.emit('start_meeting', {
  meeting_id: 'the_meeting_id',
  host_id: 'your_user_id'
});

// End a meeting (hosts/admins only)
socket.emit('end_meeting', {
  meeting_id: 'the_meeting_id',
  host_id: 'your_user_id',
  recording_url: 'optional_recording_url'
});

// Listen for meeting status changes
socket.on('meeting_started', (data) => {
  console.log('Meeting started:', data);
});

socket.on('meeting_ended', (data) => {
  console.log('Meeting ended:', data);
});
```

## Prayer Requests

```javascript
// Listen for new prayer requests
socket.on('new_prayer_request', (prayerRequest) => {
  console.log('New prayer request:', prayerRequest);
});

// Listen for answered prayers
socket.on('prayer_request_answered', (data) => {
  console.log('Prayer request answered:', data);
});
```

## Notifications

```javascript
// Listen for notifications
socket.on('notification', (notification) => {
  console.log('New notification:', notification);
});

// Listen for meeting notifications
socket.on('meeting_notification', (notification) => {
  console.log('Meeting notification:', notification);
});

// Listen for prayer notifications
socket.on('prayer_notification', (notification) => {
  console.log('Prayer notification:', notification);
});

// Mark notifications as read (done through REST API)
// This socket event informs you when your notifications have been read
socket.on('notifications_read', (data) => {
  console.log(`All notifications read. Unread count: ${data.count}`);
});
```
