import { render, screen, within } from "@testing-library/react";
import { updateLogs } from "../../data/updateLogs";
import UpdateLog from "./UpdateLog";

describe("UpdateLog", () => {
  it("marks the version from the previous app opening", () => {
    const lastOpenedVersion = updateLogs[1].version;

    render(
      <UpdateLog
        open
        currentVersion={updateLogs[0].version}
        lastOpenedVersion={lastOpenedVersion}
        onClose={() => undefined}
      />,
    );

    const versionButton = screen
      .getByText(`v${lastOpenedVersion}`)
      .closest("button");

    expect(versionButton).not.toBeNull();
    expect(within(versionButton!).getByText("上次打开")).toBeInTheDocument();
    expect(screen.getAllByText("上次打开")).toHaveLength(1);
    const currentVersionButton = within(
      screen.getByLabelText("版本时间线"),
    )
      .getByText(`v${updateLogs[0].version}`)
      .closest("button");

    expect(currentVersionButton).not.toBeNull();
    expect(
      within(currentVersionButton!).getByText("当前版本"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("当前版本")).toHaveLength(1);
    expect(
      screen.getByText(
        `（由 v${lastOpenedVersion} 更新至 v${updateLogs[0].version}）`,
      ),
    ).toBeInTheDocument();
  });
});
