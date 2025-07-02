export namespace main {
	
	export class Conversation {
	    id: number;
	    session_id: string;
	    file_keys: string;
	    title: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Conversation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.session_id = source["session_id"];
	        this.file_keys = source["file_keys"];
	        this.title = source["title"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
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
	export class ConversationMessage {
	    id: number;
	    conversation_id: number;
	    message_type: string;
	    content: string;
	    sql: string;
	    query_result: string;
	    insights: string;
	    suggestions: string;
	    debug_info: string;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new ConversationMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.conversation_id = source["conversation_id"];
	        this.message_type = source["message_type"];
	        this.content = source["content"];
	        this.sql = source["sql"];
	        this.query_result = source["query_result"];
	        this.insights = source["insights"];
	        this.suggestions = source["suggestions"];
	        this.debug_info = source["debug_info"];
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
	export class DebugInfo {
	    original_prompt?: string;
	    system_prompt?: string;
	    user_prompt?: string;
	    llm_raw_response?: any;
	    processing_time?: number;
	    api_endpoint?: string;
	    model_used?: string;
	
	    static createFrom(source: any = {}) {
	        return new DebugInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.original_prompt = source["original_prompt"];
	        this.system_prompt = source["system_prompt"];
	        this.user_prompt = source["user_prompt"];
	        this.llm_raw_response = source["llm_raw_response"];
	        this.processing_time = source["processing_time"];
	        this.api_endpoint = source["api_endpoint"];
	        this.model_used = source["model_used"];
	    }
	}
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
	    suggestions: string[];
	    debug_info?: DebugInfo;
	
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
	        this.suggestions = source["suggestions"];
	        this.debug_info = this.convertValues(source["debug_info"], DebugInfo);
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
	export class PromptSQLMapping {
	    id: number;
	    business_id: string;
	    file_key: string;
	    prompt_text: string;
	    sql: string;
	    definition: string;
	    description: string;
	    confidence: number;
	    ddl_hash: string;
	    usage_count: number;
	    // Go type: time
	    last_used_at: any;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new PromptSQLMapping(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.business_id = source["business_id"];
	        this.file_key = source["file_key"];
	        this.prompt_text = source["prompt_text"];
	        this.sql = source["sql"];
	        this.definition = source["definition"];
	        this.description = source["description"];
	        this.confidence = source["confidence"];
	        this.ddl_hash = source["ddl_hash"];
	        this.usage_count = source["usage_count"];
	        this.last_used_at = this.convertValues(source["last_used_at"], null);
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
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
	export class SavedTemplate {
	    id: number;
	    file_keys: string;
	    title: string;
	    prompt_text: string;
	    sql: string;
	    description: string;
	    usage_count: number;
	    // Go type: time
	    last_used_at: any;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new SavedTemplate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.file_keys = source["file_keys"];
	        this.title = source["title"];
	        this.prompt_text = source["prompt_text"];
	        this.sql = source["sql"];
	        this.description = source["description"];
	        this.usage_count = source["usage_count"];
	        this.last_used_at = this.convertValues(source["last_used_at"], null);
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
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

