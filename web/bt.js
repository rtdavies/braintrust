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
    const socketUrl = 'wss://localhost:6868'
    let user = {
        "clientId":document.getElementById('clientid').value,
        "clientSecret":document.getElementById('clientsecret').value
    }
    
    cortex = new Cortex(user, socketUrl)
    
    let streams = ['fac']
    cortex.sub(streams)
}

function init(){
    document.getElementById('form').onsubmit = run;
}

function teardown() {
    if (running && cortex) {
        // TODO: implement close()
        // cortex.close()
    }
}

class Cortex {
    constructor (user, socketUrl) {
        // create socket
        this.socket = new WebSocket(socketUrl)        
        this.user = user
    }
    
    requestAccess(){
        console.log('requestAccess()')
        let socket = this.socket
        let user = this.user
        return new Promise(function(resolve, reject){
            const REQUEST_ACCESS_ID = 1
            let requestAccessRequest = {
                "jsonrpc": "2.0", 
                "method": "requestAccess", 
                "params": { 
                    "clientId": user.clientId, 
                    "clientSecret": user.clientSecret
                },
                "id": REQUEST_ACCESS_ID
            }
            
            console.log('start send request: ',requestAccessRequest)
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
                        // console.log(data)
                        // console.log(JSON.parse(data)['result'].length)
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
        let user = this.user
        return new Promise(function(resolve, reject){
            const AUTHORIZE_ID = 4
            let authorizeRequest = { 
                "jsonrpc": "2.0", "method": "authorize", 
                "params": { 
                    "clientId": user.clientId, 
                    "clientSecret": user.clientSecret, 
                    "license": user.license,
                    "debit": user.debit
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
    
    /**
    * - query headset infor
    * - connect to headset with control device request
    * - authentication and get back auth token
    * - create session and get back session id
    */
    async querySessionInfo(){
        let headsetId=""
        await this.queryHeadsetId().then((headset)=>{headsetId = headset})
        this.headsetId = headsetId
        
        let ctResult=""
        await this.controlDevice(headsetId).then((result)=>{ctResult=result})
        this.ctResult = ctResult
        console.log(ctResult)
        
        let authToken=""
        await this.authorize().then((auth)=>{authToken = auth})
        this.authToken = authToken
        
        let sessionId = ""
        await this.createSession(authToken, headsetId).then((result)=>{sessionId=result})
        this.sessionId = sessionId
        
        console.log('HEADSET ID -----------------------------------')
        console.log(this.headsetId)
        console.log('\r\n')
        console.log('CONNECT STATUS -------------------------------')
        console.log(this.ctResult)
        console.log('\r\n')
        console.log('AUTH TOKEN -----------------------------------')
        console.log(this.authToken)
        console.log('\r\n')
        console.log('SESSION ID -----------------------------------')
        console.log(this.sessionId)
        console.log('\r\n')
    }
    
    /**
    * - check if user logined
    * - check if app is granted for access
    * - query session info to prepare for sub and train
    */
    async checkGrantAccessAndQuerySessionInfo(){
        let requestAccessResult = ""
        console.log('checkGrantAccessAndQuerySessionInfo()')
        await this.requestAccess().then((result)=>{requestAccessResult=result})
                
        // check if user is logged in CortexUI
        if ("error" in requestAccessResult){
            console.log('You must login on CortexUI before request for grant access then rerun')
            throw new Error('You must login on CortexUI before request for grant access')
        }else{
            console.log(requestAccessResult['result']['message'])
            // console.log(accessGranted['result'])
            if(requestAccessResult['result']['accessGranted']){
                await this.querySessionInfo()
            }
            else{
                console.log('You must accept access request from this app on CortexUI then rerun')
                throw new Error('You must accept access request from this app on CortexUI')
            }
        }   
    }
    
    
    /**
    * 
    * - check login and grant access
    * - subcribe for stream
    * - logout data stream to console or file
    */
    sub(streams){
        this.socket.addEventListener('open',async ()=>{
            await this.checkGrantAccessAndQuerySessionInfo()
            this.subRequest(streams, this.authToken, this.sessionId)
            this.socket.addEventListener('message', (data)=>{
                // log stream data to file or console here
                console.log(JSON.stringify(data))
            })
        })
    }                
}
