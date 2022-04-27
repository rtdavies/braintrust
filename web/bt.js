let cortex = null;

function connect(){
    if (!cortex) {
        connecting = true;
        let config = {
            "clientId":document.getElementById('clientid').value,
            "clientSecret":document.getElementById('clientsecret').value,
            "websocketUrl":document.getElementById('websocketurl').value
        }

        cortex = new Cortex(config)
        cortex.connect()
    }

    return false // don't reload page
}

function subscribe() {
    let streams = []
    if (cortex.session) {
        // facial expressions event stream
        let faccheckbox = document.getElementById('faccheckbox')
        if (faccheckbox.checked) {
            streams.push(faccheckbox.value)
        }

        // headset motion event stream
        let motcheckbox = document.getElementById('motcheckbox')
        if (motcheckbox.checked) {
            streams.push(motcheckbox.value)
        }

        cortex.subscribe(streams)
    }

    return false // don't reload page
}

function init(){
    document.getElementById('connectform').onsubmit = connect
    document.getElementById('subscribeform').onsubmit = subscribe
}

function teardown() {
    if (connecting && cortex) {
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
    async connect(){
        console.log('connect()')
        this.socket.addEventListener('open',async ()=>{
            let requestAccessResult = ""
            await this.requestAccess().then((result)=>{requestAccessResult=result})

            if ("error" in requestAccessResult){
                throw new Error('You must login on CortexUI before request for grant access')
            } else if(!requestAccessResult?.result?.accessGranted){
                console.log('You must accept access request from this app on CortexUI then rerun')
                throw new Error('You must accept access request from this app on CortexUI')
            }

            this.session = await this.initializeSession()

            if (this.session) {
                document.getElementById('subscribefieldset').disabled = false
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
        let controlDeviceResult = ""
        let authToken = ""
        let sessionId = ""
        await this.queryHeadsetId()
        .then((headset)=>{
            headsetId = headset
            return this.controlDevice(headsetId)
        })
        .then((result)=>{
            controlDeviceResult=result
            return this.authorize()
        })
        .then((auth)=>{
            authToken = auth
            return this.createSession(authToken, headsetId)
        })
        .then((result)=>{sessionId=result})

        console.log('Headset Id: ' + headsetId)
        console.log('ControlDevice status: ' + controlDeviceResult?.result?.message)
        console.log('Auth token: ' + authToken)
        console.log('Session Id: ' + sessionId)

        return { // session object
            "authToken": authToken,
            "id": sessionId,
            "subscribedStreams": []
        }
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

    async subscribe(streams){
        if (this.session.subscribedStreams.length > 0) {
            this.unsubscribeAll(this.session)
            this.session.subscribedStreams = []
        }

        if (streams.length > 0) {
            this.subscribeStreams(streams, this.session.authToken, this.session.id)
            this.socket.addEventListener('message', (data)=>{
                // could check stream id here to see which stream the data are from

                // log stream data to file or console here
                console.log(JSON.stringify(data))
            })

            this.session.subscribedStreams = streams
        }
    }

    unsubscribeAll(session) {
        console.log('unsubscribeAll(' + JSON.stringify(session.subscribedStreams) + ')')
        let socket = this.socket
        const UNSUB_REQUEST_ID = 7
        let subRequest = {
            "jsonrpc": "2.0",
            "method": "unsubscribe",
            "params": {
                "cortexToken": session.authToken,
                "session": session.id,
                "streams": session.subscribedStreams
            },
            "id": UNSUB_REQUEST_ID
        }
        socket.send(JSON.stringify(subRequest))
    }

    subscribeStreams(streams, authToken, sessionId) {
        console.log('subscribeStreams(' + JSON.stringify(streams) + ')')
        let socket = this.socket
        const SUB_REQUEST_ID = 6
        let subRequest = {
            "jsonrpc": "2.0",
            "method": "subscribe",
            "params": {
                "cortexToken": authToken,
                "session": sessionId,
                "streams": streams
            },
            "id": SUB_REQUEST_ID
        }
        socket.send(JSON.stringify(subRequest))
        socket.addEventListener('message', (message)=>{
            try {
                // the result returns a stream id (sid) and streamName
                // we should return the stream id

                // if(JSON.parse(data)['id']==SUB_REQUEST_ID){
                console.log(message.data)
                // }
            } catch (error) {
                console.log('createSession result error: ' + error + ': ' + JSON.stringify(message))
            }
        })
    }
}
