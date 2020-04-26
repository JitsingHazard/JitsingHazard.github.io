class DCJitsi {

    constructor(api) {
        this.api = api;
        this.player = null;
    }

    getMyId() {
        return this.api._myUserID;
    }

    send(senderId, destId, obj) {
        console.log("senderId, destId, obj", senderId, destId, obj);
        let strobj = JSON.stringify(obj);//TODO security
        if(destId == this.getMyId()){
            if(this.player)
                this.player.processMessageReceived(destId, strobj);
        }else{
            this.api.executeCommand('sendEndpointTextMessage', destId, strobj);
        }
    }

    getParticipants() {
        return this.api._participants;
    }

    setPlayer(player) {
        this.player = player;
    }

    endpointTextMessageReceived(obj) {
        console.log("obj", obj);
        if(this.player)
            this.player.processMessageReceived(obj.data.senderInfo.id, obj.data.eventData.text);
    }

    participantJoined() {
        //TODO
    }

    participantLeft() {
        //TODO
    }

    participantKickedOut() {
        //TODO
    }
}
