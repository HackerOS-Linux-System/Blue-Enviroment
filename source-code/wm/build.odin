package wm

import "core:build"

main :: proc() {
    b := build.default_builder()
    build.add_package(&b, ".")
    build.set_output(&b, "blue-wm")
    build.set_optimization_level(&b, .Max)
    build.set_no_bounds_check(&b, true)
    build.build(&b)
}

