/**
 * Represents the object type of the plugin MasterPose_JailBreak.
 *
 * @author Master Pose
 * @description Jail breaks Construct runtime so you can have full control on your game.
 * @see https://masterpose.itch.io/jail-break-c3
 */
declare class IJailBreakType<InstanceType extends IJailBreakInstance> extends IObjectType<InstanceType> {
    get realRuntime(): IRealRuntime;
}
