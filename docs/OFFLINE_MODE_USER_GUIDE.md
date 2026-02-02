# WebWaka Offline Mode: User Guide

**Version:** 1.0  
**Last Updated:** February 1, 2026  
**Audience:** End Users

---

## What is Offline Mode?

**Offline Mode** allows you to continue working with WebWaka even when you don't have an internet connection. Your work is saved locally on your device and automatically synchronized with the server when you reconnect.

### Why Offline-First?

We designed WebWaka to be **offline-first** because we believe you should never lose productivity due to connectivity issues. Whether you're on a plane, in a remote location, or experiencing network problems, WebWaka keeps working.

---

## What Works Offline?

### ✅ Core Features (Always Available)

These features work completely offline with no limitations:

#### 1. Task Management
- **Create new tasks** with all details (title, description, priority, due date)
- **Update existing tasks** (modify any field, change status, add notes)
- **Delete tasks** (remove tasks you no longer need)
- **View task lists** (see all your tasks, filter, and sort)
- **View task details** (see complete information about any task)

#### 2. Data Viewing
- **View your dashboard** (see key metrics and summaries)
- **View entity details** (tasks, projects, contacts, etc.)
- **Browse your data** (navigate through all cached information)

#### 3. Commerce Operations (for merchants)
- **Create orders** (process sales and generate receipts)
- **View order history** (review past transactions)
- **Update inventory** (adjust stock levels)
- **View product catalog** (browse available products)

#### 4. Session Management
- **Stay logged in** (remain authenticated for up to 24 hours offline)
- **Re-verify identity** (use biometrics or PIN after inactivity)
- **Secure your session** (automatic lock after 30 minutes of inactivity)

### ⚠️ Limited Features (Partial Offline Support)

These features work offline with some limitations:

#### 1. Search
- **Search your cached data** (find information in data already on your device)
- ❌ Cannot search for new data not yet downloaded
- ❌ Full-text search may be limited to key fields

#### 2. Notifications
- **View cached notifications** (see recent notifications already downloaded)
- **Mark notifications as read** (status syncs when you reconnect)
- ❌ Cannot receive new notifications until you reconnect

#### 3. File Attachments
- **Attach files to tasks** (files are stored locally and uploaded later)
- **View previously downloaded files** (access files already on your device)
- ❌ Large files (>10MB) wait for WiFi connection to upload
- ❌ Cannot download new files until you reconnect

### ❌ Online-Only Features

These features require an internet connection:

#### 1. Initial Login
- **First-time authentication** requires internet to verify your identity
- After initial login, you can stay logged in offline for up to 24 hours

#### 2. Large File Uploads
- **Files larger than 10MB** are queued and uploaded when you have a stable connection
- You'll see a "pending upload" indicator for queued files

#### 3. Admin Configuration
- **System settings changes** require internet to ensure consistency
- You can view settings offline, but cannot modify them

#### 4. Real-Time Collaboration
- **Live presence indicators** (who's online, who's editing) are unavailable offline
- You can still edit shared documents offline, but won't see collaborators' cursors

---

## How to Use Offline Mode

### Step 1: Initial Setup (Requires Internet)

1. **Log in to WebWaka** with your credentials
2. **Browse the data you need** (tasks, projects, contacts, etc.)
3. WebWaka automatically caches this data for offline use

### Step 2: Go Offline

1. **Disconnect from the internet** (or lose connectivity naturally)
2. **Continue working** as normal
3. **Look for the offline indicator** (usually in the top bar)

### Step 3: Work Offline

1. **Create, update, and delete** tasks and other data
2. **View your dashboard** and browse your information
3. **Process orders** (for merchants)
4. **Attach files** (they'll upload when you reconnect)

### Step 4: Reconnect and Sync

1. **Reconnect to the internet** (WiFi or mobile data)
2. **Automatic sync begins** (you'll see a sync indicator)
3. **Wait for sync to complete** (usually a few seconds)
4. **Verify your changes** (check that everything synced correctly)

---

## Understanding Sync Status

### Sync Indicators

| Indicator | Meaning | What to Do |
|-----------|---------|------------|
| 🟢 **Online** | Connected and synced | Nothing - you're all set |
| 🟡 **Syncing** | Uploading your offline changes | Wait for sync to complete |
| 🔴 **Offline** | No internet connection | Work normally, sync happens when you reconnect |
| ⚠️ **Sync Error** | Something went wrong | Check error message, retry, or contact support |
| 📤 **Pending Sync** | Changes waiting to upload | These will sync when you reconnect |

### What Gets Synced?

When you reconnect, WebWaka automatically syncs:
- ✅ All tasks you created, updated, or deleted
- ✅ All orders you processed
- ✅ All inventory changes you made
- ✅ All notification read statuses
- ✅ All file attachments (small files immediately, large files when on WiFi)

---

## Troubleshooting

### Problem: "I can't log in offline"

**Symptom:** Login screen appears even though you were logged in before.

**Cause:** Your session expired (24-hour limit) or you logged out.

**Solution:**
1. Reconnect to the internet
2. Log in again
3. Your offline data will sync automatically

---

### Problem: "My changes aren't syncing"

**Symptom:** Sync indicator shows "Pending Sync" for a long time.

**Possible Causes:**
1. **No internet connection** - Check your WiFi or mobile data
2. **Slow connection** - Wait a bit longer, especially if you have many changes
3. **Server error** - Check WebWaka status page or contact support

**Solution:**
1. Verify you have internet connectivity
2. Try manually triggering sync (pull down to refresh)
3. If problem persists, contact support with error details

---

### Problem: "I see a 'Conflict Detected' message"

**Symptom:** Message appears saying data was modified both offline and online.

**Cause:** You (or someone else) modified the same data on another device while you were offline.

**Solution:**
1. **Review the conflict** - See what changed on each side
2. **Choose a resolution** - Keep your version, keep server version, or merge
3. **Confirm your choice** - The conflict will be resolved

**How WebWaka Resolves Conflicts:**
- **Last-write-wins** (default) - Most recent change is kept
- **Manual resolution** - You choose which version to keep
- **Merge** - Both changes are combined (when possible)

---

### Problem: "I'm running out of storage"

**Symptom:** Message appears saying "Storage quota exceeded" or "Cannot cache more data".

**Cause:** Your device has limited storage for offline data (default: 50MB, max: 500MB).

**Solution:**
1. **Clear old data** - Go to Settings > Offline Mode > Clear Cache
2. **Reduce cache size** - Go to Settings > Offline Mode > Cache Settings
3. **Prioritize important data** - Choose which data to keep offline

---

### Problem: "My file attachment isn't uploading"

**Symptom:** File shows "Pending Upload" for a long time.

**Possible Causes:**
1. **File is too large** - Files >10MB wait for WiFi connection
2. **No internet connection** - File will upload when you reconnect
3. **Slow connection** - Large files take time to upload

**Solution:**
1. Check file size (Settings > Offline Mode > Pending Uploads)
2. Connect to WiFi if file is large
3. Wait for upload to complete (you can continue working)
4. Cancel and re-attach if upload fails repeatedly

---

### Problem: "I can't find data I'm looking for"

**Symptom:** Search returns no results or data seems missing.

**Cause:** Data hasn't been cached yet (you need to view it online first).

**Solution:**
1. **Reconnect to the internet**
2. **Browse to the data you need** (tasks, projects, etc.)
3. **Wait for data to cache** (usually automatic)
4. **Go offline again** - Data is now available offline

---

## Frequently Asked Questions (FAQ)

### How long can I work offline?

**Answer:** You can work offline for up to **24 hours** before you need to reconnect and re-authenticate. After 30 minutes of inactivity, you'll need to re-verify your identity (biometric or PIN) but can continue working offline.

---

### Will I lose data if my device crashes while offline?

**Answer:** No. WebWaka saves your changes to local storage immediately. Even if your device crashes or the app closes unexpectedly, your changes are preserved and will sync when you reconnect.

---

### Can I work on multiple devices offline?

**Answer:** Yes, but be aware of potential conflicts. If you modify the same data on multiple devices while offline, you'll need to resolve conflicts when both devices sync.

---

### How much data can I store offline?

**Answer:** By default, WebWaka caches up to **50MB** of data. You can increase this to **500MB** in Settings. Older data is automatically removed when you reach the limit.

---

### What happens if I delete something offline and someone else modified it online?

**Answer:** When you sync, WebWaka will detect the conflict and ask you to choose:
- **Keep deletion** - The item is deleted on the server
- **Keep modification** - The item is restored with the online changes
- **Review** - See both versions and decide

---

### Can I use WebWaka on a plane?

**Answer:** Yes! Enable offline mode before boarding, and you can work throughout your flight. Your changes will sync when you land and reconnect.

---

### Does offline mode work on mobile and desktop?

**Answer:** Yes. Offline mode works on:
- ✅ Web browsers (Chrome, Firefox, Safari, Edge)
- ✅ iOS mobile app
- ✅ Android mobile app
- ✅ Desktop apps (Windows, macOS, Linux)

---

### How do I know if I'm in offline mode?

**Answer:** Look for the **offline indicator** in the top bar of the app. It will show:
- 🟢 **Online** - Connected to the internet
- 🔴 **Offline** - No internet connection
- 🟡 **Syncing** - Uploading changes

---

### Can I force a sync?

**Answer:** Yes. Pull down to refresh (mobile) or click the sync button (desktop) to manually trigger a sync. This is useful if automatic sync seems stuck.

---

### What if I don't want to use offline mode?

**Answer:** Offline mode is always enabled for core features (tasks, orders, etc.) to ensure you never lose data. However, you can:
- Disable automatic caching (Settings > Offline Mode > Auto-Cache)
- Clear cached data (Settings > Offline Mode > Clear Cache)
- Reduce cache size (Settings > Offline Mode > Cache Settings)

---

## Best Practices

### 1. Cache Important Data Before Going Offline

Before you know you'll be offline (e.g., before a flight), browse the data you'll need:
- Open task lists you'll work on
- View projects you'll reference
- Check orders you might need to review

### 2. Sync Regularly

When you have internet connectivity, let WebWaka sync:
- Don't immediately go offline after reconnecting
- Wait for the sync indicator to show "Online"
- Verify your changes synced correctly

### 3. Monitor Storage Usage

Keep an eye on your offline storage:
- Check Settings > Offline Mode > Storage Usage
- Clear old data periodically
- Increase cache size if you need more offline data

### 4. Resolve Conflicts Promptly

When conflicts appear:
- Review them as soon as possible
- Don't ignore conflict notifications
- Choose the resolution that makes sense for your workflow

### 5. Keep Your App Updated

Offline mode improvements are released regularly:
- Update WebWaka when new versions are available
- Check the changelog for offline mode enhancements
- Report any offline mode issues to support

---

## Privacy & Security

### Data Encryption

All offline data is encrypted on your device using **AES-256-GCM** encryption. This means:
- ✅ Your data is secure even if your device is lost or stolen
- ✅ No one can access your offline data without your credentials
- ✅ Encryption is automatic - no setup required

### Session Security

Your offline session is protected:
- ✅ Sessions expire after 24 hours offline
- ✅ Automatic lock after 30 minutes of inactivity
- ✅ Biometric or PIN re-verification required after lock
- ✅ No privilege escalation (you can't gain admin rights offline)

### Data Retention

Offline data is retained for:
- **30 days** - Cached data older than 30 days is automatically deleted
- **Until sync** - Pending changes are kept until successfully synced
- **Until cleared** - You can manually clear cached data anytime

---

## Need Help?

### Support Resources

- **Help Center:** [help.webwaka.com](https://help.webwaka.com)
- **Community Forum:** [community.webwaka.com](https://community.webwaka.com)
- **Email Support:** support@webwaka.com
- **Live Chat:** Available in-app (when online)

### Reporting Issues

If you encounter problems with offline mode:
1. **Check this guide** for troubleshooting steps
2. **Check WebWaka status page** for known issues
3. **Contact support** with:
   - Description of the problem
   - Steps to reproduce
   - Device and app version
   - Screenshots (if applicable)

---

**Happy offline working! 🚀**
