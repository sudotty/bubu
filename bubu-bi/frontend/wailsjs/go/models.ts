export namespace main {
	
	export class File {
	    id: number;
	    filename: string;
	    file_path: string;
	    file_size: number;
	    // Go type: time
	    upload_time: any;
	    file_type: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new File(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.filename = source["filename"];
	        this.file_path = source["file_path"];
	        this.file_size = source["file_size"];
	        this.upload_time = this.convertValues(source["upload_time"], null);
	        this.file_type = source["file_type"];
	        this.status = source["status"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class InstallationInfo {
	    isFirstInstall: boolean;
	    // Go type: time
	    installTime: any;
	
	    static createFrom(source: any = {}) {
	        return new InstallationInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.isFirstInstall = source["isFirstInstall"];
	        this.installTime = this.convertValues(source["installTime"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class InstanceManager {
	
	
	    static createFrom(source: any = {}) {
	        return new InstanceManager(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}
	export class LLMProcessResult {
	    sql: string;
	    business_id: string;
	    definition: string;
	    description: string;
	    confidence: number;
	
	    static createFrom(source: any = {}) {
	        return new LLMProcessResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sql = source["sql"];
	        this.business_id = source["business_id"];
	        this.definition = source["definition"];
	        this.description = source["description"];
	        this.confidence = source["confidence"];
	    }
	}
	export class QueryHistory {
	    id: number;
	    query: string;
	    query_type: string;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new QueryHistory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.query = source["query"];
	        this.query_type = source["query_type"];
	        this.created_at = this.convertValues(source["created_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class QueryResult {
	    columns: string[];
	    rows: any[][];
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new QueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = source["columns"];
	        this.rows = source["rows"];
	        this.total = source["total"];
	    }
	}
	export class SystemInfo {
	    upload_path: string;
	    database_path: string;
	    upload_size: number;
	    database_size: number;
	
	    static createFrom(source: any = {}) {
	        return new SystemInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.upload_path = source["upload_path"];
	        this.database_path = source["database_path"];
	        this.upload_size = source["upload_size"];
	        this.database_size = source["database_size"];
	    }
	}
	export class UpdateInfo {
	    currentVersion: string;
	    latestVersion: string;
	    hasUpdate: boolean;
	    updateUrl: string;
	    releaseNotes: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.hasUpdate = source["hasUpdate"];
	        this.updateUrl = source["updateUrl"];
	        this.releaseNotes = source["releaseNotes"];
	    }
	}

}

