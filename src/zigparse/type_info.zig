/// The typeinfo union
pub const TypeInfo = union(TypeId) {
    Type: void,
    Void: void,
    Bool: void,
    NoReturn: void,
    Int: Int,
    Float: Float,
    Pointer: Pointer,
    Array: Array,
    Struct: Struct,
    ComptimeFloat: void,
    ComptimeInt: void,
    Undefined: void,
    Null: void,
    Optional: Optional,
    ErrorUnion: ErrorUnion,
    ErrorSet: ErrorSet,
    Enum: Enum,
    Union: Union,
    Fn: Fn,
    BoundFn: Fn,
    ArgTuple: void,
    Opaque: void,
    Promise: Promise,
    Vector: Vector,
    EnumLiteral: void,


    pub const Int = struct {
        is_signed: bool,
        bits: comptime_int,
    };

    pub const Float = struct {
        bits: comptime_int,
    };

    pub const Pointer = struct {
        size: Size,
        is_const: bool,
        is_volatile: bool,
        alignment: comptime_int,
        child: type,
        is_allowzero: bool,

        pub const Size = enum {
            One,
            Many,
            Slice,
            C,
        };
    };

    pub const Array = struct {
        len: comptime_int,
        child: type,
    };

    pub const ContainerLayout = enum {
        Auto,
        Extern,
        Packed,
    };

    pub const StructField = struct {
        name: []const u8,
        offset: ?comptime_int,
        field_type: type,
    };

    pub const Struct = struct {
        layout: ContainerLayout,
        fields: []StructField,
        defs: []Definition,
    };

    pub const Optional = struct {
        child: type,
    };

    pub const ErrorUnion = struct {
        error_set: type,
        payload: type,
    };

    pub const Error = struct {
        name: []const u8,
        value: comptime_int,
    };

    pub const ErrorSet = ?[]Error;

    pub const EnumField = struct {
        name: []const u8,
        value: comptime_int,
    };

    pub const Enum = struct {
        layout: ContainerLayout,
        tag_type: type,
        fields: []EnumField,
        defs: []Definition,
    };

    pub const UnionField = struct {
        name: []const u8,
        enum_field: ?EnumField,
        field_type: type,
    };

    pub const Union = struct {
        layout: ContainerLayout,
        tag_type: ?type,
        fields: []UnionField,
        defs: []Definition,
    };

    pub const CallingConvention = enum {
        Unspecified,
        C,
        Cold,
        Naked,
        Stdcall,
        Async,
    };

    pub const FnArg = struct {
        is_generic: bool,
        is_noalias: bool,
        arg_type: ?type,
    };

    pub const Fn = struct {
        calling_convention: CallingConvention,
        is_generic: bool,
        is_var_args: bool,
        return_type: ?type,
        async_allocator_type: ?type,
        args: []FnArg,
    };

    pub const Promise = struct {
        child: ?type,
    };

    pub const Vector = struct {
        len: comptime_int,
        child: type,
    };

    pub const Definition = struct {
        name: []const u8,
        is_pub: bool,
        data: Data,

        pub const Data = union(enum) {
            Type: type,
            Var: type,
            Fn: FnDef,

            pub const FnDef = struct {
                fn_type: type,
                inline_type: Inline,
                calling_convention: CallingConvention,
                is_var_args: bool,
                is_extern: bool,
                is_export: bool,
                lib_name: ?[]const u8,
                return_type: type,
                arg_names: [][] const u8,

                pub const Inline = enum {
                    Auto,
                    Always,
                    Never,
                };
            };
        };
    };
};