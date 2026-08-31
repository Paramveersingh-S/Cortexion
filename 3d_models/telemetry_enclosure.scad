// Vigilante Telemetry Hub Enclosure
// This script is for OpenSCAD (a free 3D modeling software).
// Simply download OpenSCAD, paste this code, and click "Render" to export an STL for 3D printing!
// Units: millimeters

length = 100;
width = 75;
height = 35;
wall = 2;
corner_radius = 5;

module rounded_box(l, w, h, r) {
    hull() {
        translate([r, r, 0]) cylinder(r=r, h=h, $fn=50);
        translate([l-r, r, 0]) cylinder(r=r, h=h, $fn=50);
        translate([r, w-r, 0]) cylinder(r=r, h=h, $fn=50);
        translate([l-r, w-r, 0]) cylinder(r=r, h=h, $fn=50);
    }
}

module base_shell() {
    difference() {
        // Outer shell
        rounded_box(length, width, height, corner_radius);
        
        // Inner hollow (carving out the inside)
        translate([wall, wall, wall])
            rounded_box(length-2*wall, width-2*wall, height, corner_radius);
            
        // Cutout for ESP32 USB Port (Left side)
        translate([-1, width/2 - 6, wall + 2])
            cube([wall+2, 12, 8]);
            
        // Cutout for OBD-II Cable and Sensor Wires (Right side)
        translate([length - wall - 1, width/2 - 10, wall + 2])
            cube([wall+2, 20, 10]);
            
        // Ventilation slots (Front side)
        for (i = [20 : 10 : length-20]) {
            translate([i, -1, wall + 10])
                cube([4, wall+2, 15]);
        }
    }
}

module lid() {
    difference() {
        // Lid base plate
        rounded_box(length, width, wall, corner_radius);
        
        // Cutout for 2.4" TFT Display (Active viewing area ~ 49x36)
        translate([(length - 49)/2, (width - 36)/2, -1])
            cube([49, 36, wall + 2]);
    }
    
    // Inner lip for a snap/friction fit into the base
    translate([wall + 0.2, wall + 0.2, wall])
        difference() {
            rounded_box(length - 2*wall - 0.4, width - 2*wall - 0.4, 3, corner_radius - wall);
            translate([wall, wall, -1])
                rounded_box(length - 4*wall - 0.4, width - 4*wall - 0.4, 5, corner_radius - 2*wall);
        }
}

module standoffs() {
    // 4 standoffs for mounting a generic proto-board or the ESP32
    // Sized for M2.5 or M3 self-tapping screws
    positions = [
        [15, 15, wall],
        [length - 15, 15, wall],
        [15, width - 15, wall],
        [length - 15, width - 15, wall]
    ];
    
    for (p = positions) {
        translate(p)
            difference() {
                cylinder(r=3.5, h=6, $fn=30); // Standoff pillar
                translate([0,0,1]) cylinder(r=1.2, h=6, $fn=30); // Screw hole
            }
    }
}

// ----------------------------------------------------
// RENDER COMMANDS
// ----------------------------------------------------

// 1. Render the Base Shell and Standoffs
base_shell();
standoffs();

// 2. Render the Lid (Shifted to the side so both print flat on the build plate)
translate([0, width + 10, 0])
    lid();
