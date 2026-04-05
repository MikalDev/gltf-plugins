declare class IRealRuntime {
    [key: string]: any;
}

/**
 * Represents an instance of the plugin MasterPose_JailBreak.
 *
 * @author Master Pose
 * @description Jail breaks Construct runtime so you can have full control on your game.
 * @see https://masterpose.itch.io/jail-break-c3
 */
declare class IJailBreakInstance extends IWorldInstance {
    get realRuntime(): IRealRuntime;
}
