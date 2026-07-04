# SH4 Matrix Viewer

Simple web page to visualise states of the Front Bank and MXTRX after each SH4 instruction.

Note: This is a work in progress. Can help with simple matrix ops but don't rely on it for literally anything regarding accuracy.
Created because I was annoyed stepping via GDB

### TODO

* Validate `FSRRA` and `FSCA` instructions.
* Validate arithmatic operations (epscially with FDIV on INF and NaN)
* Validate double operations
* Add `FTRV` and `FIPR`
* Move the simulator code into separate file
* Make the page look less garbage overall

## Screenshots
![Preview of Matrix Viewer](/images/pv-img.png)