# genetic_algorithm

https://www.geeksforgeeks.org/genetic-algorithms/
https://developer.mozilla.org/en-US/docs/Games/Tutorials/2D_Breakout_game_pure_JavaScript

**change 1**

Refactor the code into separate game.js and index.html

Refactor this so that all the user input is removed. A function will be passed in that generates a fixed number of random movements. For each frame it will draw the next movement from the function and use it to move the paddle.

**change 2**

clean separation of HTML and JavaScript

display a timer that increases by 1 each frame until the end of game

**change 3**

when game ends reset the game and use reset the score, timer to zero. The highest value of the timer is shown on the screen. When the game ends the highest timer is updated if required.

The score is added to the final timer at the end of the game.

http-server -p 3000 -c-1 --cors