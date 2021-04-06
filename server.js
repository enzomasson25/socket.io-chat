var mongoose = require('mongoose');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var i;
var usersConnected;
const redis = require("redis");
const client = redis.createClient();
client.del("users") // We want a fresh new list!

var alert = require('alert');

mongoose.set('useNewUrlParser', true)
mongoose.set('useFindAndModify', false)
mongoose.set('useCreateIndex', true)
mongoose.connect('mongodb://localhost:27017/test', {useNewUrlParser: true, useUnifiedTopology: true})



const Message = mongoose.model('Message', new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  username: String,
  date: {
    type: Date,
    default: Date.now,
    index: 1
  },
  type: {
    type: String,
    enum : ['chat','service', 'login', 'logout'],
    default: 'chat'
  },
}))




client.on("error", function(error) {
  console.error(error);
});

client.on("ready", function(error) {
  console.log("Connected to redis")
});

/**
 * Gestion des requêtes HTTP des utilisateurs en leur renvoyant les fichiers du dossier 'public'
 */
app.use('/', express.static(__dirname + '/public'));

/**
 * Liste des utilisateurs connectés
 */
var users = [];

/**
 * Historique des messages
 */
var messages = [];

/**
 * Liste des utilisateurs en train de saisir un message
 */
var typingUsers = [];


const initUser = async socket => {
  /**
   * Emission d'un événement "user-login" pour chaque utilisateur connecté
   */
  /** 
   * Emission d'un événement "chat-message" pour chaque message de l'historique
   */
   for (i = 0; i < messages.length; i++) {
    if (messages[i].type === 'chat-message') {
      socket.emit('chat-message', messages[i]);
    } else {
      socket.emit('service-message', messages[i]);
    }
  }

  /**
   * Emission d'un événement "chat-message" pour chaque message de l'historique
   */
  // TODO check if user is connected (redis) and skip this part
  const dbMessages = await Message.find({}).sort({date: -1}).limit(50)
  dbMessages.reverse().forEach(message => {
    if (message.type === 'chat') socket.emit('chat-message', message)
    else socket.emit('service', message)
  })
}


io.on('connection', function (socket) {

  /**
   * Utilisateur connecté à la socket
   */
  var loggedUser;


  initUser(socket).catch(console.error)


  /**
   * Emission d'un événement "user-login" pour chaque utilisateur connecté
   */
  for (i = 0; i < users.length; i++) {
    socket.emit('user-login', users[i]);
  }

  /**
   * Déconnexion d'un utilisateur
   */
   socket.on('disconnect', async () => {
    if (loggedUser !== undefined) {
      // Broadcast d'un 'service-message'
      var serviceMessage = {
        text: 'User "' + loggedUser.username + '" disconnected',
        type: 'logout',
      };
      socket.broadcast.emit('service-message', serviceMessage);
      // Suppression de la liste des connectés
      client.lrem("users", userIndex, loggedUser.username, function (err,reply){
        console.log(loggedUser.username  + " s'est déconnecté")
      })

      // Ajout du message à l'historique
      await Message.create(serviceMessage)
      // Emission d'un 'user-logout' contenant le user
      io.emit('user-logout', loggedUser);
      // Si jamais il était en train de saisir un texte, on l'enlève de la liste
      var typingUserIndex = typingUsers.indexOf(loggedUser);
      if (typingUserIndex !== -1) {
        typingUsers.splice(typingUserIndex, 1);
      }
    }
  });

  /**
   * Connexion d'un utilisateur via le formulaire :
   */
   socket.on('user-login', function (user, callback) {

    client.sadd('allUsers', user.username, function(err, reply) {
      if (reply==1){
        console.log("Hello to this new users : "+user.username)
      }
    });

    // Vérification que l'utilisateur n'existe pas
    var userIndex = -1;
    for (i = 0; i < users.length; i++) {
      if (users[i].username === user.username) {
        userIndex = i;
      }
    }

    if (user !== undefined && userIndex === -1) { // S'il est bien nouveau
      // Sauvegarde de l'utilisateur et ajout à la liste des connectés
      //if the user isnt connected

      //add user connected on redis
      client.lpush('users', user.username, function(err, reply) {
      console.log(user.username + " s'est connecté")
      console.log("Il y a " + reply + " personnes connecté(s)")
      });
      
      loggedUser = user;
      users.push(loggedUser);
      // Envoi et sauvegarde des messages de service
      var userServiceMessage = {
        text: 'You logged in as "' + loggedUser.username + '"',
        type: 'login'
      };
      var broadcastedServiceMessage = {
        text: 'User "' + loggedUser.username + '" logged in',
        type: 'login'
      };
      socket.emit('service-message', userServiceMessage);
      socket.broadcast.emit('service-message', broadcastedServiceMessage);
      messages.push(broadcastedServiceMessage);
      // Emission de 'user-login' et appel du callback
      io.emit('user-login', loggedUser);
      callback(true);
    } else {
      alert("You are already connected")
      callback(false);
    }
  });

  /**
   * Réception de l'événement 'chat-message' et réémission vers tous les utilisateurs
   */
  socket.on('chat-message', async(message) => {

    // Sauvegarde du message
    await Message.create({
      text: message.text,
      username: loggedUser.username
    })

    // On ajoute le username au message et on émet l'événement
    message.username = loggedUser.username;
    // On assigne le type "message" à l'objet
    message.type = 'chat-message';
    io.emit('chat-message', message);
    // Sauvegarde du message

    //incrementer le nombre de message du user de 1 
    client.sismember('allUsers',loggedUser.username, function(error,reply){
      if(reply==1){// si il existe alors incrémenter
        client.incr(loggedUser.username)
        client.get(loggedUser.username,function(error,reply){ //affiche le nombre de message qu'il a posté
          console.log("C'est le "+reply+"ème message de "+loggedUser.username);
        });
      }
      else{ // sinon créer la key
        client.set(loggedUser.username,1);
        console.log(loggedUser.username + " a posté son premier message !");
      }
    });


    messages.push(message);
    if (messages.length > 150) {
      messages.splice(0, 1);
    }
  });

  /**
   * Réception de l'événement 'start-typing'
   * L'utilisateur commence à saisir son message
   */
  socket.on('start-typing', function () {
    // Ajout du user à la liste des utilisateurs en cours de saisie
    if (typingUsers.indexOf(loggedUser) === -1) {
      typingUsers.push(loggedUser);
    }
    io.emit('update-typing', typingUsers);
  });

  /**
   * Réception de l'événement 'stop-typing'
   * L'utilisateur a arrêter de saisir son message
   */
  socket.on('stop-typing', function () {
    var typingUserIndex = typingUsers.indexOf(loggedUser);
    if (typingUserIndex !== -1) {
      typingUsers.splice(typingUserIndex, 1);
    }
    io.emit('update-typing', typingUsers);
  });
});

/**
 * Lancement du serveur en écoutant les connexions arrivant sur le port 3000
 */
http.listen(3000, function () {
  console.log('Server is listening on *:3000');
});