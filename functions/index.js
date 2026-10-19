/* functions/index.js — সব Cloud Function এক জায়গা থেকে এক্সপোর্ট */
'use strict';
Object.assign(exports,
    require('./auth'),
    require('./gifts'),
    require('./rewards'),
    require('./store'),
    require('./roles'),
    require('./rooms')
);
