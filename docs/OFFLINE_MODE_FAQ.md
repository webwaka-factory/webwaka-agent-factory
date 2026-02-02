# WebWaka Offline Mode: Frequently Asked Questions (FAQ)

**Version:** 1.0  
**Last Updated:** February 1, 2026

---

## General Questions

### What is offline mode?

Offline mode allows you to use WebWaka without an internet connection. Your work is saved locally on your device and automatically synchronized with the server when you reconnect.

---

### Why does WebWaka have offline mode?

We believe you should never lose productivity due to connectivity issues. Whether you're on a plane, in a remote location, or experiencing network problems, WebWaka keeps working.

---

### Do I need to enable offline mode?

No. Offline mode is always enabled for core features (tasks, orders, etc.) to ensure you never lose data. WebWaka automatically detects when you're offline and switches to offline mode.

---

### How do I know if I'm in offline mode?

Look for the **offline indicator** in the top bar of the app:
- 🟢 **Online** - Connected to the internet
- 🔴 **Offline** - No internet connection
- 🟡 **Syncing** - Uploading changes

---

## Features & Limitations

### What works offline?

**Core features that work completely offline:**
- Create, update, and delete tasks
- View task lists and details
- View dashboard and metrics
- Create and view orders (for merchants)
- Stay logged in (up to 24 hours)
- Re-verify identity with biometrics or PIN

**Features with limited offline support:**
- Search (cached data only)
- Notifications (cached notifications only)
- File attachments (queued for upload)

**Features that require internet:**
- Initial login
- Large file uploads (>10MB)
- Admin configuration changes
- Real-time collaboration presence

---

### Can I create tasks offline?

Yes! You can create, update, and delete tasks offline. Your changes are saved locally and automatically synced when you reconnect.

---

### Can I search for data offline?

Yes, but only cached data. If you haven't viewed data online yet, it won't be available for search offline. The app will show "Searching cached data only" when offline.

---

### Can I upload files offline?

Yes, but with limitations:
- **Small files (<10MB)** are queued and uploaded when you reconnect
- **Large files (>10MB)** wait for a WiFi connection
- You'll see a "pending upload" indicator for queued files

---

### Can I use WebWaka on a plane?

Yes! Enable offline mode before boarding, and you can work throughout your flight. Your changes will sync when you land and reconnect.

---

## Session & Authentication

### How long can I work offline?

You can work offline for up to **24 hours** before you need to reconnect and re-authenticate. After 30 minutes of inactivity, you'll need to re-verify your identity (biometric or PIN) but can continue working offline.

---

### Why do I need to log in again after 24 hours offline?

For security reasons, sessions expire after 24 hours offline. This ensures that if your device is lost or stolen, your data remains protected.

---

### What happens if I'm inactive for 30 minutes?

Your session is locked, and you'll need to re-verify your identity using biometrics (Face ID, Touch ID, fingerprint) or your PIN. This protects your data if you leave your device unattended.

---

### Can I log in for the first time offline?

No. Initial authentication requires an internet connection to verify your identity with the server. After your first login, you can work offline for up to 24 hours.

---

## Data & Sync

### Will I lose data if my device crashes while offline?

No. WebWaka saves your changes to local storage immediately. Even if your device crashes or the app closes unexpectedly, your changes are preserved and will sync when you reconnect.

---

### How much data can I store offline?

By default, WebWaka caches up to **50MB** of data. You can increase this to **500MB** in Settings. Older data is automatically removed when you reach the limit.

---

### What happens when I reconnect?

When you reconnect, WebWaka automatically:
1. Uploads your offline changes to the server
2. Downloads new changes from the server
3. Resolves any conflicts (if data was modified both offline and online)
4. Shows a sync indicator during the process

---

### How long does sync take?

Sync usually takes a few seconds, depending on:
- Number of changes made offline
- Size of files being uploaded
- Network speed

You'll see a progress indicator during sync.

---

### Can I force a sync?

Yes. Pull down to refresh (mobile) or click the sync button (desktop) to manually trigger a sync. This is useful if automatic sync seems stuck.

---

### What if sync fails?

If sync fails, WebWaka will:
1. Show an error message explaining the issue
2. Retry automatically with exponential backoff (1s, 2s, 4s, 8s, 16s)
3. Keep your changes queued for later sync
4. Allow you to manually retry

Your data is never lost - it remains queued until successfully synced.

---

## Conflicts

### What is a conflict?

A conflict occurs when the same data is modified both offline and online. For example:
- You update a task offline
- Someone else updates the same task online
- Both changes need to be reconciled when you sync

---

### How does WebWaka resolve conflicts?

WebWaka uses **last-write-wins** by default - the most recent change is kept. You can also:
- **Manually resolve** - Choose which version to keep
- **Merge** - Combine both changes (when possible)

---

### Will I be notified of conflicts?

Yes. When a conflict is detected, you'll see a notification with options to:
- Review the conflict
- Choose your version
- Choose the server version
- Merge both versions

---

### Can I prevent conflicts?

Conflicts are inevitable in offline-first systems, but you can minimize them by:
- Syncing regularly when online
- Avoiding editing the same data on multiple devices simultaneously
- Resolving conflicts promptly when they appear

---

## Multiple Devices

### Can I work on multiple devices offline?

Yes, but be aware of potential conflicts. If you modify the same data on multiple devices while offline, you'll need to resolve conflicts when both devices sync.

---

### How do I sync data across devices?

Data syncs automatically when each device reconnects to the internet. All devices will eventually have the same data (eventual consistency).

---

### What if I delete something on one device and modify it on another?

When both devices sync, WebWaka will detect the conflict and ask you to choose:
- **Keep deletion** - The item is deleted on all devices
- **Keep modification** - The item is restored with the changes
- **Review** - See both versions and decide

---

## Storage & Performance

### How do I check my offline storage usage?

Go to **Settings > Offline Mode > Storage Usage** to see:
- Total storage used
- Storage by data type (tasks, orders, etc.)
- Available storage remaining

---

### What happens when I run out of storage?

When you reach your storage limit, WebWaka will:
1. Show a warning message
2. Automatically remove the oldest cached data
3. Keep your pending changes (never deleted)
4. Suggest increasing your storage limit or clearing cache

---

### How do I clear my offline cache?

Go to **Settings > Offline Mode > Clear Cache**. This will:
- Remove all cached data
- Keep your pending changes (not yet synced)
- Free up storage space

**Warning:** You'll need to re-download data when you go online.

---

### Does offline mode slow down the app?

No. Offline mode is designed for performance:
- Local database operations are fast (milliseconds)
- No network latency
- Optimized indexing for quick queries

In fact, offline mode is often **faster** than online mode because there's no network delay.

---

## Security & Privacy

### Is my offline data secure?

Yes. All offline data is encrypted using **AES-256-GCM** encryption. This means:
- Your data is secure even if your device is lost or stolen
- No one can access your offline data without your credentials
- Encryption is automatic - no setup required

---

### Can someone access my data if they steal my device?

No. Your offline data is encrypted and protected by:
- Device encryption (OS-level)
- App-level encryption (AES-256-GCM)
- Session expiration (24 hours max)
- Inactivity lock (30 minutes)
- Biometric/PIN re-verification

---

### What data is stored offline?

Only data you've viewed or created is stored offline:
- Tasks you've viewed or created
- Orders you've processed
- Dashboard metrics
- Notifications you've received
- Files you've attached

Data you haven't accessed is not cached.

---

### Can I disable offline mode?

Offline mode for core features (tasks, orders) is always enabled to prevent data loss. However, you can:
- Disable automatic caching (Settings > Offline Mode > Auto-Cache)
- Clear cached data (Settings > Offline Mode > Clear Cache)
- Reduce cache size (Settings > Offline Mode > Cache Settings)

---

## Troubleshooting

### My changes aren't syncing. What should I do?

**Possible causes:**
1. **No internet connection** - Check your WiFi or mobile data
2. **Slow connection** - Wait a bit longer
3. **Server error** - Check WebWaka status page

**Solutions:**
1. Verify you have internet connectivity
2. Try manually triggering sync (pull down to refresh)
3. Check for error messages
4. Contact support if problem persists

---

### I see "Storage quota exceeded". What should I do?

**Solution:**
1. Go to **Settings > Offline Mode > Clear Cache**
2. Clear old data you no longer need
3. Increase your storage limit (Settings > Offline Mode > Cache Settings)
4. Reduce the amount of data you cache

---

### I can't find data I'm looking for. Why?

**Possible causes:**
1. Data hasn't been cached yet (you need to view it online first)
2. Data was removed due to storage limits
3. Data is too old (>30 days)

**Solution:**
1. Reconnect to the internet
2. Browse to the data you need
3. Wait for data to cache
4. Go offline again - data is now available

---

### My file isn't uploading. What should I do?

**Possible causes:**
1. File is too large (>10MB) - waiting for WiFi
2. No internet connection
3. Slow connection

**Solution:**
1. Check file size (Settings > Offline Mode > Pending Uploads)
2. Connect to WiFi if file is large
3. Wait for upload to complete
4. Cancel and re-attach if upload fails repeatedly

---

### I see a "Conflict Detected" message. What should I do?

**Solution:**
1. Review the conflict - see what changed on each side
2. Choose a resolution:
   - **Keep your version** - Your offline changes are kept
   - **Keep server version** - Server changes are kept
   - **Merge** - Both changes are combined (when possible)
3. Confirm your choice

**Tip:** Resolve conflicts promptly to avoid confusion.

---

## Platform-Specific Questions

### Does offline mode work on web browsers?

Yes. Offline mode works on:
- Chrome (recommended)
- Firefox
- Safari
- Edge

**Note:** Some browsers may have stricter storage limits.

---

### Does offline mode work on mobile?

Yes. Offline mode works on:
- iOS (iPhone, iPad)
- Android (phones, tablets)

Mobile apps have larger storage limits (500MB) than web browsers.

---

### Does offline mode work on desktop?

Yes. Desktop apps (Windows, macOS, Linux) have the largest storage limits (1GB) and best performance.

---

### Can I use offline mode on multiple platforms?

Yes. You can use offline mode on web, mobile, and desktop simultaneously. Data syncs across all platforms when you reconnect.

---

## Advanced Questions

### How does WebWaka detect conflicts?

WebWaka uses **vector clocks** or **timestamps** to detect conflicts:
- Each change has a version number and timestamp
- When syncing, WebWaka compares versions
- If both offline and online versions have changed, a conflict is detected

---

### What is "eventual consistency"?

**Eventual consistency** means data will eventually be the same across all devices, but may be temporarily different. This is a trade-off for offline-first systems:
- ✅ You can always work offline
- ⚠️ Data may be temporarily inconsistent
- ✅ Conflicts are detected and resolved

---

### Can I customize conflict resolution?

Yes. Go to **Settings > Offline Mode > Conflict Resolution** to choose:
- **Last-write-wins** (default) - Most recent change wins
- **First-write-wins** - First change wins
- **Manual** - You choose every time
- **Merge** - Attempt to merge changes

---

### How does WebWaka handle deleted data?

WebWaka uses **soft deletes**:
- Deleted data is marked as deleted, not physically removed
- When syncing, deletions are propagated to the server
- Conflicts between deletions and modifications are detected
- You can choose to keep deletion or restore modification

---

### Can I sync over cellular data?

Yes, but with limitations:
- **Small changes** sync over cellular
- **Large files (>10MB)** wait for WiFi
- You can change this in **Settings > Offline Mode > Sync Settings**

---

### How does WebWaka optimize bandwidth?

WebWaka uses several techniques:
- **Delta sync** - Only changes since last sync are transferred
- **Compression** - Data is compressed before transfer
- **Batch operations** - Multiple changes are sent together
- **Deferred uploads** - Large files wait for WiFi

---

## Getting Help

### Where can I get more help?

- **Help Center:** [help.webwaka.com](https://help.webwaka.com)
- **Community Forum:** [community.webwaka.com](https://community.webwaka.com)
- **Email Support:** support@webwaka.com
- **Live Chat:** Available in-app (when online)

### How do I report a bug?

1. Go to **Settings > Help > Report a Bug**
2. Describe the problem
3. Include steps to reproduce
4. Attach screenshots (if applicable)
5. Submit

Our team will investigate and respond within 24 hours.

---

### How do I suggest a feature?

1. Go to **Settings > Help > Suggest a Feature**
2. Describe your idea
3. Explain why it would be useful
4. Submit

We review all suggestions and prioritize based on user demand.

---

**Still have questions? Contact us at support@webwaka.com**
