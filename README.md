# Socket.io : Chat Fait avec Théo Bernardin

Cette application reprend les sources du tutoriel présent sur le blog [bini.io](http://blog.bini.io) :

* [Partie 1](http://blog.bini.io/developper-une-application-avec-socket-io/)
* [Partie 2](http://blog.bini.io/developper-un-chat-avec-socket-io-partie-2/)
* [Partie 3](http://blog.bini.io/developper-un-chat-avec-socket-io-partie-3/)

Ce tutoriel est lui même une adaptation du [tutoriel officiel](http://socket.io/get-started/chat/) de socket.io.

Cette version ajoute les fonctionnalités suivantes par rapport à la version du tutoriel officiel :

* Support des noms d'utilisateurs
* Affichage d'un message lors de la connexion/déconnexion d'un utilisateur
* Affichage de la liste des utilisateurs connectés
* Conservation d'un historique des messages
* Affichage du texte "typing" à côté du nom des utilisateurs en train de saisir un message


## Installation

Si vous n'avez pas bower d'installé sur votre machine, installez-le au préalable de la façon suivante :
```
npm install -g bower
```

Pour installer l'application, téléchargez les sources (zip ou git clone) et exécutez la commande suivante depuis la racine du projet.
```
npm install
bower install
```

## Démarrer l'application

Pour démarrer l'application, exécutez la commande suivante depuis la racine du projet.
```
node server
```

L'application est désormais accesssible à l'url **http://localhost:3000/**.



# Rajout des fonctionalités

* Utilisateurs et stockage ✅
* Connaître quels sont les utilisateurs connectés et les afficher (en utilisant Redis) ✅
* Stocker l'ensemble des messages dans MongoDB ✅
* Utiliser le ReplicaSet pour permettre une meilleure tolérance aux pannes.✅


# Mise en place des replicaset 

Nous allons créer 1 serveur primary et deux serveurs secondary qui vont permettrent la replication des données. Pour ce faire on créer 3 dossiers R0S1, R0S2 , R0S3 dans le repertoire data. Ensuite on effectue les commandes suivante pour lancer les replicaset sur différents port.

```
mongod --replSet rs0 --port 27018 --dbpath ./data/RS01

mongod --replSet rs1 --port 27019 --dbpath ./data/RS02

mongod --replSet rs2 --port 27020 --dbpath ./data/RS03
```

On se connecte ensuite au port 27018 qui est le serveur principale pour connecter les replicasets

Ensuite on initialise le replicaset : rs.initiate() On ajoute les replicasets: rs.add(‘localhost :27020’).

Pour finir on créer un serveur arbitre qui va élire le serveur primary. On evite les temps de latences de l'élection

```
mongod --replSet rs0 --port 3000 --dbpath ./data/arb
``` 
il suffit d’exécuter la commande rs.addArb(‘localhost :3000’) dans le client mongo. Dès cet instant, l’arbitre élit le primary et les deux secondary.

Voici le resultat de ces commandes : 
<img width="1432" alt="Capture d’écran 2021-04-06 à 19 08 33" src="https://user-images.githubusercontent.com/47392406/113752286-12295600-970d-11eb-8042-a5f9c742bcb8.png">

(On voit une erreur lors de la création de l'arborescence des réplicas, je m'étais trompé de numéro de port sur mes réplicats, une erreur que j'ai régler mais j'ai oublié de reprendre un screen)


# Stockage des messages dans MangoDB

A l'émission d'un message sur le tchat, celui-ci est archivé dans notre base de donnée MongoDB. Nous utilisons les schémas mongoose pour créer nos objets messages et pour les stocker dans notre base de données depuis le front-end de notre app. 

## Voici le résultat : 

Sur l'app : 

![Capture d’écran 2021-04-06 à 20 19 49](https://user-images.githubusercontent.com/47392406/113759805-ccbd5680-9715-11eb-891e-7191e3416dc8.png)


Dans la base de données : 

<img width="892" alt="Capture d’écran 2021-04-06 à 20 19 11" src="https://user-images.githubusercontent.com/47392406/113759842-d941af00-9715-11eb-89e1-384f1f9f8017.png">


