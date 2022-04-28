let cortex = null;

// Called on page load. Binds javascript functions to the html forms
function init(){
    document.getElementById('connectform').onsubmit = connect
    document.getElementById('subscribeform').onsubmit = updateSubscriptions
}

// Get Cortex API Connection Configuration form values and connect to server
function connect(){
    try {
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
    } catch (error) {
        cortex = null
        console.log('Error while connecting to Cortex server: ' + error)
    }

    return false // don't reload page
}

// Update event subscriptions to match checked checkboxes
function updateSubscriptions() {
    let streams = []
    try {
        if (cortex.session) {
            document.getElementById("subscribefieldset")
            .querySelectorAll("[type=checkbox]:checked")
            .forEach(checkbox => streams.push(checkbox.value))

            cortex.updateSubscriptions(streams)
        }
    } catch (error) {
        console.log('Error while subscribing to streams' + JSON.stringify(streams) + ': ' + error)
    }

    return false // don't reload page
}

// Constants to represent Cortex API message types
apis = {
    REQUEST_ACCESS: 1,
    QUERY_HEADSETS: 2,
    CONTROL_DEVICE: 3,
    AUTHORIZE: 4,
    CREATE_SESSION: 5,
    SUBSCRIBE: 6,
    UNSUBSCRIBE: 7
}

// A Cortex server that exposes a websocket API
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

        // Eventually we'll subscribe to some event streams. Add a listener for those events.
        this.socket.addEventListener('message', (message)=>{
            try {
                let msgData = JSON.parse(message.data)
                if(msgData?.id==apis.SUBSCRIBE){
                    // process the response to the subscribe request
                    msgData.result.success.forEach(success => {
                        this.session.subscribedStreams.push(success.streamName)
                    })

                    console.log('Subscribed streams: ' + JSON.stringify(this.session.subscribedStreams))

                    // TODO: process failures?

                } else if ('sid' in msgData) {
                    // process a subscribedStream's event
                    console.log(JSON.stringify(msgData))
                }
            } catch (error) {
                console.log('subscribe result error: ' + error + ': ' + JSON.stringify(message))
            }
        })

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
                document.getElementById('connectfieldset').disabled = true
                document.getElementById('subscribefieldset').disabled = false
            }
        })
    }

    requestAccess(){
        console.log('requestAccess()')
        let socket = this.socket
        let config = this.config
        return new Promise(function(resolve, reject){
            let requestAccessRequest = {
                "jsonrpc": "2.0",
                "method": "requestAccess",
                "params": {
                    "clientId": config.clientId,
                    "clientSecret": config.clientSecret
                },
                "id": apis.REQUEST_ACCESS
            }

            socket.send(JSON.stringify(requestAccessRequest));

            socket.addEventListener('message', (message)=>{
                try {
                    let msgData = JSON.parse(message.data)
                    if(msgData?.id==apis.REQUEST_ACCESS){
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
        await this.queryHeadsets()
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

    queryHeadsets(){
        console.log('queryHeadsets()')
        let socket = this.socket
        let queryHeadsetRequest =  {
            "jsonrpc": "2.0",
            "id": apis.QUERY_HEADSETS,
            "method": "queryHeadsets",
            "params": {}
        }

        return new Promise(function(resolve, reject){
            socket.send(JSON.stringify(queryHeadsetRequest));
            socket.addEventListener('message', (message)=>{
                try {
                    let msgData = JSON.parse(message.data)
                    if(msgData?.id==apis.QUERY_HEADSETS){
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
            let authorizeRequest = {
                "jsonrpc": "2.0", "method": "authorize",
                "params": {
                    "clientId": config.clientId,
                    "clientSecret": config.clientSecret
                },
                "id": apis.AUTHORIZE
            }
            socket.send(JSON.stringify(authorizeRequest))
            socket.addEventListener('message', (message)=>{
                try {
                    let msgData = JSON.parse(message.data)
                    if(msgData?.id==apis.AUTHORIZE){
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
        let controlDeviceRequest = {
            "jsonrpc": "2.0",
            "id": apis.CONTROL_DEVICE,
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
                    if(msgData?.id==apis.CONTROL_DEVICE){
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
        let createSessionRequest = {
            "jsonrpc": "2.0",
            "id": apis.CREATE_SESSION,
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
                    if(msgData?.id==apis.CREATE_SESSION){
                        let sessionId = msgData.result.id
                        resolve(sessionId)
                    }
                } catch (error) {
                    console.log('createSession result error: ' + error + ': ' + JSON.stringify(message))
                }
            })
        })
    }

    async updateSubscriptions(streams){
        if (this.session.subscribedStreams.length > 0) {
            this.unsubscribeAll(this.session)
            this.session.subscribedStreams = []
        }

        if (streams.length > 0) {
            this.subscribe(streams, this.session)
        }
    }

    unsubscribeAll(session) {
        console.log('unsubscribeAll(' + JSON.stringify(session.subscribedStreams) + ')')
        let socket = this.socket
        let subRequest = {
            "jsonrpc": "2.0",
            "method": "unsubscribe",
            "params": {
                "cortexToken": session.authToken,
                "session": session.id,
                "streams": session.subscribedStreams
            },
            "id": apis.UNSUBSCRIBE
        }
        socket.send(JSON.stringify(subRequest))
    }

    subscribe(streams, session) {
        let socket = this.socket
        let subRequest = {
            "jsonrpc": "2.0",
            "method": "subscribe",
            "params": {
                "cortexToken": session.authToken,
                "session": session.id,
                "streams": streams
            },
            "id": apis.SUBSCRIBE
        }
        socket.send(JSON.stringify(subRequest))
    }
}
