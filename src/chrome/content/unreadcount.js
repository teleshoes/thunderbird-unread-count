Components.utils.import("resource://app/modules/iteratorUtils.jsm");

var unreadcount = {
	MSG_FOLDER_FLAG_INBOX: 0x1000,
	onLoad : function(e) {
		dump("Loading Unread Count...\n");
		
		// read all the preferences
		const PREF_SERVICE = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
		this.prefs = PREF_SERVICE.getBranch("extensions.unreadcount@teleshoes.com.");
		this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.prefs.addObserver("", this, false);
     
     	this.traverseDeep = this.prefs.getBoolPref("traverse-deep");
 
		// initialization code
		this.initialized = true;
	},
	
	onClose: function(e) {
		dump("Closing Unread Count...\n");
		
		this.prefs.removeObserver("", this);
		
		this.initialized = true;
		this.resetUnreadCount();
	},
	
	resetUnreadCount: function() {
		dump("Resetting unread count\n");
		this.updateUnreadCount("Count Reset");
	},
	
	updateUnreadCount: function(msg){
		const DIR_SERVICE = new Components.Constructor("@mozilla.org/file/directory_service;1","nsIProperties");
		try { 
			path=(new DIR_SERVICE()).get("ProfD", Components.interfaces.nsIFile).path; 
		} catch (e) {
			alert(error);
		}
		
        path += "/unread-counts";
		var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);		
		file.initWithPath(path);
 
		var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
		               createInstance(Components.interfaces.nsIFileOutputStream);
		foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);
		var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].
		                createInstance(Components.interfaces.nsIConverterOutputStream);
		converter.init(foStream, "UTF-8", 0, 0);
		converter.writeString(msg);
		converter.close();
	},

	onItemCountChanged : function() {
		dump("Item count changed...\n");
		if (this.timeoutId != -1) {
			window.clearTimeout(this.timeoutId);
		}
		// Schedule on the main thread
		this.timeoutId = window.setTimeout(this.performUnreadCount, 1000, this);
	},
	
	performUnreadCount: function(that) {
		dump("Counting unread messages...\n");
		var countMessage = "";
        for each(let account in fixIterator(MailServices.accounts.accounts, Components.interfaces.nsIMsgAccount)){
			var rootFolder = account.incomingServer.rootFolder; // nsIMsgFolder            
				if (rootFolder.hasSubFolders) {
					countMessage += that.getTotalCount(rootFolder) + ":" + account.incomingServer.prettyName + "\n";
				}
		}
		dump("Count message : " + countMessage + "\n");
		that.updateUnreadCount(countMessage);
	},

	getTotalCount: function(rootFolder) {
		if(rootFolder.getAllFoldersWithFlag) {
			return this._getTotalCountTB2(rootFolder);
		} else {
			return this._getTotalCountTB3(rootFolder);
		}
	},
	
	_getTotalCountTB2: function(rootFolder) {
		dump("Using _getTotalCountTB2\n");
		var totalCount = 0;
		dump("Finding all folders with inbox flag : " + this.MSG_FOLDER_FLAG_INBOX + "\n");
		var subFolders = rootFolder.getAllFoldersWithFlag(this.MSG_FOLDER_FLAG_INBOX); //nsISupportsArray
		dump("Found " + subFolders.Count() + "folders\n");
		
		for(var i = 0; i < subFolders.Count(); i++) {
			var folder = subFolders.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgFolder);
			dump("Get Number of unread messages with travese deep = " +  this.traverseDeep + "\n");
			totalCount += folder.getNumUnread(this.traverseDeep);
		}
		
		dump("Found total " + totalCount + "in all subFolders\n");
		return totalCount;
	},

	_getTotalCountTB3: function(rootFolder) {
		dump("Using _getTotalCountTB3\n");
		var totalCount = 0;
		dump("Finding all folders with inbox flag : " + this.MSG_FOLDER_FLAG_INBOX + "\n");
		var subFolders = rootFolder.getFoldersWithFlags(this.MSG_FOLDER_FLAG_INBOX); //nsIArray
		var subFoldersEnumerator = subFolders.enumerate();
		
		while(subFoldersEnumerator.hasMoreElements()) {
			var folder = subFoldersEnumerator.getNext().QueryInterface(Components.interfaces.nsIMsgFolder);
			dump("Get Number of unread messages with travese deep = " +  this.traverseDeep + "\n");
			totalCount += folder.getNumUnread(this.traverseDeep);
		}
		
		dump("Found total " + totalCount + "in all subFolders\n");
		return totalCount;
	},

	folderListener : {
		OnItemAdded : function(parent, item, viewString) {
				unreadcount.onItemCountChanged();
		},
		OnItemRemoved : function(parent, item, viewString) {
				unreadcount.onItemCountChanged();
		},
		OnItemPropertyFlagChanged : function(item, property, oldFlag, newFlag) {
			if (property=="Status"){
				unreadcount.onItemCountChanged();
			}
		},
		OnItemEvent : function(item, event) {
				unreadcount.onItemCountChanged();
		},
		
		OnFolderLoaded : function(aFolder) {},
		OnDeleteOrMoveMessagesCompleted : function(aFolder) {},
		OnItemPropertyChanged : function(parent, item, viewString) {},
		OnItemIntPropertyChanged : function(item, property, oldVal, newVal) {},
		OnItemBoolPropertyChanged : function(item, property, oldValue, newValue) {},
		OnItemUnicharPropertyChanged : function(item, property, oldValue, newValue) {}
	},
	
	observe: function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
 
		switch(data) {
			case "traverse-deep":
				this.traverseDeep = this.prefs.getBoolPref("traverse-deep");
				unreadcount.onItemCountChanged();
			break;
		}
	},
	
	mailSession: '',
	notifyFlags: '',
	timeoutId: -1
};

window.addEventListener("load", function(e) { unreadcount.onLoad(e); }, false);
window.addEventListener("close", function(e) { unreadcount.onClose(e); }, false); 

unreadcount.mailSession = Components.classes["@mozilla.org/messenger/services/session;1"].getService(Components.interfaces.nsIMsgMailSession);
unreadcount.notifyFlags = Components.interfaces.nsIFolderListener.all;
unreadcount.mailSession.AddFolderListener(unreadcount.folderListener, unreadcount.notifyFlags);
