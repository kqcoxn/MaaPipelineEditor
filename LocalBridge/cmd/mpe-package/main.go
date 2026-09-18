package main

import (
	"context"
	"flag"
	"fmt"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/install"
	"os"
)

func main() {
	version := flag.String("version", "", "MPE release version")
	mfw := flag.String("mfw-version", "", "MFW version")
	binaries := flag.String("binaries", "", "binary artifacts directory")
	editor := flag.String("editor", "", "Editor archive")
	output := flag.String("output", "", "output directory")
	desktopConfig := flag.String("desktop-config", "", "shared Desktop release configuration")
	flag.Parse()
	if *version == "" || *mfw == "" || *binaries == "" || *editor == "" || *output == "" {
		fmt.Fprintln(os.Stderr, "全部发布参数均为必填")
		os.Exit(1)
	}
	minimum, err := install.ReadMinimumDesktopRevision(*desktopConfig)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := install.BuildRelease(context.Background(), *version, *mfw, *binaries, *editor, *output, minimum); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
