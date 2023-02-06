# StarShell | Extension Scripts

### Execution Worlds
A content script can either run in Main world (where it shares the same global as the page), or in Isolated world. In order to establish a secure connection between page scripts and the extension, as well as to covertly discover advertisement requests, StarShell must run scripts in both execution worlds, some of which are already registered while others are executed on-demand.

Isolated-world content scripts can communicate with the background/service-worker but cannot observer or mutate the main world's global scope. 

### File Naming Convention
Isolated-world content scripts are given the file name prefix `ics-`.
Main-world content scripts are given the file name prefix `mcs-`.
