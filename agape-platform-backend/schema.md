### MongoDB Collections

1. **users** - User accounts
   - `_id`: ObjectId (primary key)
   - `first_name`: String
   - `last_name`: String
   - `email`: String (unique)
   - `password_hash`: String
   - `role`: String (super_admin, camp_leader, member, guest)
   - `camp_id`: ObjectId (reference to camps collection)
   - `phone`: String
   - `profile_image`: String (URL)
   - `spiritual_gifts`: Array of Strings
   - `joined_date`: Date
   - `is_active`: Boolean
   - `last_login`: Date

2. **camps** - Ministry camps/groups
   - `_id`: ObjectId (primary key)
   - `name`: String
   - `description`: String
   - `leader_id`: ObjectId (reference to users collection)
   - `created_at`: Date
   - `meeting_schedule`: Array of Objects
   - `is_active`: Boolean

3. **messages** - Communication between users
   - `_id`: ObjectId (primary key)
   - `content`: String
   - `sender_id`: ObjectId (reference to users collection)
   - `recipient_type`: String (ministry, camp, user)
   - `recipient_id`: ObjectId (reference to camps or users collection)
   - `message_type`: String (text, image, document, video)
   - `attachment_urls`: Array of Strings
   - `is_announcement`: Boolean
   - `created_at`: Date
   - `is_deleted`: Boolean
   - `read_by`: Array of ObjectIds (references to users collection)

4. **meetings** - Virtual gatherings
   - `_id`: ObjectId (primary key)
   - `title`: String
   - `description`: String
   - `scheduled_start`: Date
   - `scheduled_end`: Date
   - `host_id`: ObjectId (reference to users collection)
   - `meeting_type`: String (prayer, bible_study, camp_meeting, etc.)
   - `camp_id`: ObjectId (reference to camps collection, null for ministry-wide)
   - `is_recurring`: Boolean
   - `recurring_pattern`: Object
   - `recurring_group_id`: ObjectId (for recurring instances)
   - `meeting_link`: String
   - `status`: String (scheduled, in_progress, completed, cancelled)
   - `created_at`: Date
   - `attendees`: Array of ObjectIds (references to users collection)
   - `recording_url`: String
   - `reminders_sent`: Boolean

5. **prayer_requests** - Prayer needs
   - `_id`: ObjectId (primary key)
   - `content`: String
   - `user_id`: ObjectId (reference to users collection)
   - `is_private`: Boolean
   - `is_anonymous`: Boolean
   - `camp_id`: ObjectId (reference to camps collection, null for ministry-wide)
   - `created_at`: Date
   - `status`: String (active, answered, archived)
   - `is_testimony`: Boolean
   - `praying_users`: Array of ObjectIds (references to users collection)
   - `testimony_content`: String

6. **notifications** - User notifications
   - `_id`: ObjectId (primary key)
   - `user_id`: ObjectId (reference to users collection)
   - `title`: String
   - `body`: String
   - `related_type`: String (meeting, prayer_request, message)
   - `related_id`: ObjectId
   - `created_at`: Date
   - `is_read`: Boolean

7. **password_resets** - Password reset tokens
   - `_id`: ObjectId (primary key)
   - `user_id`: ObjectId (reference to users collection)
   - `token`: String
   - `expires_at`: Date
   - `used`: Boolean
