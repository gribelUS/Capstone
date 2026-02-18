# Capstone


```How to Run on Jetson Nano```
Option 1: Internal Simulation
The controller runs its own built-in Simulation

python controller.py --simulate --sim-pattern balanced
| Flag | Description |
|------|-------------|
| --simulate | Tells controller to use simulation instead of camera 
| --sim-pattern | Traffic pattern: balanced, morning_rush, evening_rush, east_west_heavy, north_south_heavy, light_traffic, heavy_traffic 

Option 2: External Simulation Server
Run a separate simulation that the controller connects to.

Terminal 1: Start the simulation Server
python simulation.py --mode server --port 5556 --pattern balanced

Terminal 2: Start the controller
python controller.py --simulate --sim-port 5556

Option 3: Test with both CV and Simulation
Terminal 1: Start CV
cd "CV Module-20260217T230210Z-1-001/CV Module"
python yolo_test.py --video video.mp4 --port 5555

Terminal 2: Start Controller connected to the real camera
python controller.py --cv-port 5555

