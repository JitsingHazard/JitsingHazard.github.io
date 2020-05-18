
class Player {

    //TODO security:
    // - stringify
    // - find a way to identify GM id
    // - only accept msg from GM
    // - XSS any field
    //TODO feature:
    // - register a listener in DC to receive events
    static colors = ['green', 'yellow', 'red', 'blue', 'orange', 'lime', 'silver', 'maroon', 'aqua', 'purple'];

    constructor(dc) {
        this.dc = dc;
        this.id = this.dc.getMyId();
        this.dc.setPlayer(this);

        this.game = new Vue({
            el: '#game',
            data: {
                players: [],
                cards: [],
                isJudge: false,
                judgeId: null,
                status: GM.ST_IDLE,
                myPlayerid: this.id,
                isGM: false,
                bonus_round: false,
            },
            methods: {
                playerColor: function(playeridx) {
                    return Player.colors[playeridx % Player.colors.length];
                }
            }
        });
    }
    shuffle(array,judgeId,myPlayerid) {
        let tab=[...array]

        let judge = {}
        let myPlayer = {}

        let without_judge = tab.reduce((total,player)=>{
            if (player.id == judgeId){judge = player}
            if (player.id == myPlayerid){myPlayer = player}
            return player.id != judgeId && player.id != myPlayerid ? [...total,player]:total
        },[])
        
       without_judge.sort(() => Math.random() - 0.5);
       return judgeId==myPlayerid?[judge,...without_judge]:[judge,myPlayer,...without_judge]
    }
    updateGame(game) {
        this.game.isJudge = (this.id == game.info.judgeId);
        this.game.judgeId = game.info.judgeId;
        this.game.bonus_round = game.info.bonus_round;
        this.game.status = game.info.st;
        if(this.game.status == GM.ST_IDLE){//game has been reset
            this.GMid = null;//anyone can host a new game
            this.game.cards.length = 0;
            this.game.players.length = 0;
        }else{//it's on !
            let random_players =  this.game.status == 6 ? this.shuffle(game.players, game.info.judgeId, this.id):game.players
            this.game.cards.splice(0, this.game.cards.length, ...game.hand);
            this.game.players.splice(0,this.game.players.length, ...random_players);
        }
    }

    startGame() {
        if(this.game.status == GM.ST_IDLE || this.game.status == GM.ST_WAIT_MIN_PARTICIPANTS || this.game.isGM) {
            this.GMid = this.id;
            this.gm = new GM(this.dc, this.id);
            this.game.isGM = true;
            this.game.status = this.gm.startGame();
            if(this.game.status == GM.ST_WAIT_MIN_PARTICIPANTS) {//failed to start game
                this.game.isGM = false;
                this.GMid = null;
                this.game.isJudge = false;
                this.game.judgeId = null;
                delete this.gm;
            }
        }
    }

    pickCard(idx, pos) {
        let obj = new Object();
        obj['_type'] = GM.EVT_PICK;
        obj['data'] = {'idx': idx, 'pos': pos};
        this.sendToGM(this.id, obj);
    }

    vote(playerId) {
        let obj = new Object();
        obj['_type'] = GM.EVT_VOTE;
        obj['data'] = {'id': playerId};
        this.sendToGM(this.id, obj);
    }

    nextRound(playerId) {
        let obj = new Object();
        obj['_type'] = GM.EVT_NEXT;
        obj['data'] = {'id': playerId};
        this.sendToGM(this.id, obj);
    }

    quitGame() {
        let obj = new Object();
        obj['_type'] = GM.EVT_QUIT_GAME;
        obj['data'] = {'id': this.id};
        this.sendToGM(this.id, obj);
        this.game.status = GM.ST_IDLE;
        this.game.isGM = false;
        this.GMid = null;
        this.game.isJudge = false;
        this.game.judgeId = null;
        delete this.gm;
        this.game.players.splice(0,this.game.players.length);
        this.game.cards.splice(0, this.game.cards.length);
    }

    sendToGM(senderId, obj) {
        if(this.game.isGM)
            this.gm.processObjectReceived(senderId, obj);
        else if(this.GMid)
            this.dc.send(senderId, this.GMid, obj);
    }

    processMessageReceived(id, strobj) {
        if(this.GMid == null)
            this.GMid = id;
        let obj = JSON.parse(strobj);//TODO YOLO
        if(id == this.GMid && obj._type == GM.EVT_UPDATE_GAME){//received EVT_UPDATE_GAME event from GM
            this.updateGame(obj.data);
        }else if(this.game.isGM){
            this.gm.processObjectReceived(id, obj);
        }
    }
}
