let running = false;
let cortex = null;

function run(){
    if (!running) {
        running = true;
        start();
    }
    return false; // don't reload page
}

function start() {
    let config = {
        "clientId":document.getElementById('clientid').value,
        "clientSecret":document.getElementById('clientsecret').value,
        "websocketUrl":document.getElementById('websocketurl').value
    }
    
    cortex = new Cortex(config)
    cortex.connect()
    
    // let streams = ['fac']
    // cortex.subscribe(streams)
}

function init(){
    document.getElementById('form').onsubmit = run;
}

function teardown() {
    if (running && cortex) {
        // TODO: implement disconnect()
        // cortex.disconnect()
    }
}

class Cortex {
    constructor (config) {
        this.socket = new WebSocket(config.websocketUrl)        
        this.config = config
    }
    
    /*
     * see Cortex API documnetation for steps to create an API session
     * https://emotiv.gitbook.io/cortex-api/overview-of-api-flow
     */
    connect(){
        console.log('connect()')
        this.socket.addEventListener('open',async ()=>{
            let requestAccessResult = ""
            await this.requestAccess().then((result)=>{requestAccessResult=result})
                    
            if ("error" in requestAccessResult){
                throw new Error('You must login on CortexUI before request for grant access')
            } else {
                if(requestAccessResult?.result?.accessGranted){
                    await this.initializeSession()
                }
                else{
                    console.log('You must accept access request from this app on CortexUI then rerun')
                    throw new Error('You must accept access request from this app on CortexUI')
                }
            }   
        })
    }                

    requestAccess(){
        console.log('requestAccess()')
        let socket = this.socket
        let config = this.config
        return new Promise(function(resolve, reject){
            const REQUEST_ACCESS_ID = 1
            let requestAccessRequest = {
                "jsonrpc": "2.0", 
                "method": "requestAccess", 
                "params": { 
                    "clientId": config.clientId, 
                    "clientSecret": config.clientSecret
                },
                "id": REQUEST_ACCESS_ID
            }
            
            socket.send(JSON.stringify(requestAccessRequest));
            
            socket.addEventListener('message', (message)=>{
                try {
                    let msgData = JSON.parse(message.data)
                    if(msgData.id==REQUEST_ACCESS_ID){
                        resolve(msgData)
                    }
                } catch (error) {
                    console.log('requestAccess result error: ' + error + ': ' + JSON.stringify(message))
                }
            })
        })
    }
    
     async initializeSession(){
        let headsetId = ""
        await this.queryHeadsetId().then((headset)=>{headsetId = headset})
        
        let controlDeviceResult = ""
        await this.controlDevice(headsetId).then((result)=>{controlDeviceResult=result})
        
        let authToken = ""
        await this.authorize().then((auth)=>{authToken = auth})
        
        let sessionId = ""
        await this.createSession(authToken, headsetId).then((result)=>{sessionId=result})
        
        console.log('Headset Id: ' + headsetId)
        console.log('ControlDevice status: ' + controlDeviceResult?.result?.message)
        console.log('Auth token: ' + authToken)
        console.log('Session Id: ' + sessionId)

        this.authToken = authToken
        this.sessionId = sessionId
    }    
    
    queryHeadsetId(){
        console.log('queryHeadsetId()')
        const QUERY_HEADSET_ID = 2
        let socket = this.socket
        let queryHeadsetRequest =  {
            "jsonrpc": "2.0", 
            "id": QUERY_HEADSET_ID,
            "method": "queryHeadsets",
            "params": {}
        }
        
        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(queryHeadsetRequest));
            socket.addEventListener('message', (message)=>{
                try {
                    let msgData = JSON.parse(message.data)
                    if(msgData.id==QUERY_HEADSET_ID){
                        if(msgData.result.length > 0){
                            let headsetId = msgData.result[0].id
                            resolve(headsetId)
                        }
                        else{
                            console.log('No have any headset, please connect headset with your pc.')
                        }
                    }
                    
                } catch (error) {
                    console.log('queryHeadsetId result error: ' + error + ': ' + JSON.stringify(message))
                }
            })
        })
    }
    
    authorize(){
        console.log('authorize()')
        let socket = this.socket
        let config = this.config
        return new Promise(function(resolve, reject){
            const AUTHORIZE_ID = 4
            let authorizeRequest = { 
                "jsonrpc": "2.0", "method": "authorize", 
                "params": { 
                    "clientId": config.clientId, 
                    "clientSecret": config.clientSecret
                },
                "id": AUTHORIZE_ID
            }
            socket.send(JSON.stringify(authorizeRequest))
            socket.addEventListener('message', (message)=>{
                try {
                    let msgData = JSON.parse(message.data)
                    if(msgData.id==AUTHORIZE_ID){
                        let cortexToken = msgData.result.cortexToken
                        resolve(cortexToken)
                    }
                } catch (error) {
                    console.log('authorized result error: ' + error + ': ' + JSON.stringify(message))
                }
            })
        })
    }
    
    controlDevice(headsetId){
        console.log('controlDevice()')
        let socket = this.socket
        const CONTROL_DEVICE_ID = 3
        let controlDeviceRequest = {
            "jsonrpc": "2.0",
            "id": CONTROL_DEVICE_ID,
            "method": "controlDevice",
            "params": {
                "command": "connect",
                "headset": headsetId
            }
        }
        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(controlDeviceRequest));
            socket.addEventListener('message', (message)=>{
                try {
                    let msgData = JSON.parse(message.data)
                    if(msgData.id==CONTROL_DEVICE_ID){
                        resolve(msgData)
                    }
                } catch (error) {
                    console.log('controlDevice result error: ' + error + ': ' + JSON.stringify(message))
                }
            })
        }) 
    }
    
    createSession(authToken, headsetId){
        console.log('createSession()')
        let socket = this.socket
        const CREATE_SESSION_ID = 5
        let createSessionRequest = { 
            "jsonrpc": "2.0",
            "id": CREATE_SESSION_ID,
            "method": "createSession",
            "params": {
                "cortexToken": authToken,
                "headset": headsetId,
                "status": "open"
            }
        }
        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(createSessionRequest));
            socket.addEventListener('message', (message)=>{
                // console.log(data)
                try {
                    let msgData = JSON.parse(message.data)
                    if(msgData.id==CREATE_SESSION_ID){
                        let sessionId = msgData.result.id
                        resolve(sessionId)
                    }
                } catch (error) {
                    console.log('createSession result error: ' + error + ': ' + JSON.stringify(message))
                }
            })
        })
    }
    
    subscribe(streams){
        this.subRequest(streams, this.authToken, this.sessionId)
        this.socket.addEventListener('message', (data)=>{
            // log stream data to file or console here
            console.log(JSON.stringify(data))
        })
    }                
    
    subRequest(stream, authToken, sessionId){
        let socket = this.socket
        const SUB_REQUEST_ID = 6 
        let subRequest = { 
            "jsonrpc": "2.0", 
            "method": "subscribe", 
            "params": { 
                "cortexToken": authToken,
                "session": sessionId,
                "streams": stream
            }, 
            "id": SUB_REQUEST_ID
        }
        console.log('sub request: ', subRequest)
        socket.send(JSON.stringify(subRequest))
        socket.addEventListener('message', (message)=>{
            try {
                // if(JSON.parse(data)['id']==SUB_REQUEST_ID){
                console.log('SUB REQUEST RESULT --------------------------------')
                console.log(message.data)
                console.log('\r\n')
                // }
            } catch (error) {
                console.log('createSession result error: ' + error + ': ' + JSON.stringify(message))
            }
        })
    }
}
