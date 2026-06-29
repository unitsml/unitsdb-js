#!/usr/bin/env ruby
# frozen_string_literal: true

# Build script for @unitsml/unitsdb. Runs Opal::Builder against
# unitsdb-ruby's lib/unitsdb/opal.rb to produce both the external
# and self-contained flavors.
#
# Invoked from scripts/build.js via `bundle exec ruby`.

require "opal"
require "opal/builder"
require "fileutils"

# Deps of unitsdb-ruby that cannot be Opal-compiled directly:
# - lutaml-model: has its own Opal story (runtime unverified); stub
#   for now. When @lutaml/lutaml-model ships as an npm peer, remove
#   from stubs and add to prerequired.
# - fuzzy_match, rdf, rdf-turtle: C extensions or server-only.
# - logger: Ruby stdlib, Opal provides its own.
UPSTREAM_STUBS = %w[
  fuzzy_match
  rdf
  rdf/turtle
  rdf-parser
  logger
  lutaml/model
  lutaml/model/xml
  lutaml/model/json
  lutaml/model/yaml
  lutaml/model/key_value
  lutaml/model/toml
  lutaml/model/type
  lutaml/model/serialize
].freeze

ENTRY = "unitsdb/opal"

def build_app_code(ruby_dir, dist_dir)
  builder = Opal::Builder.new
  builder.append_paths(File.join(ruby_dir, "lib"))
  builder.stubs = UPSTREAM_STUBS.dup
  builder.prerequired = %w[opal]
  builder.compiler_options = { source_map: false }

  output = builder.build(ENTRY).to_s
  path = File.join(dist_dir, "unitsdb-no-opal.js")
  FileUtils.mkdir_p(dist_dir)
  File.write(path, output)
  warn "wrote #{path} (#{output.bytesize / 1024} KiB)"
  output
end

def read_runtime(runtime_pkg_root)
  candidates = [
    File.join(runtime_pkg_root, "node_modules", "@lutaml", "opal-runtime", "dist", "runtime.js"),
    File.join(runtime_pkg_root, "node_modules", "@lutaml", "opal-runtime", "dist", "runtime.cjs"),
  ]
  candidates.each do |p|
    next unless File.exist?(p)

    runtime = File.read(p)
    warn "read runtime from #{p} (#{runtime.bytesize / 1024} KiB)"
    return runtime
  end
  warn "Could not locate @lutaml/opal-runtime/dist/runtime.js. " \
       "Self-contained flavor will be empty."
  ""
end

def build_self_contained(app_code, runtime, version, dist_dir)
  header = <<~HEADER
    // @unitsml/unitsdb — self-contained build (Opal runtime embedded)
    // Generated from unitsdb-ruby v#{version}
    // Opal runtime: @lutaml/opal-runtime
    //
  HEADER
  combined = "#{header}#{runtime}\n#{app_code}"
  path = File.join(dist_dir, "unitsdb.js")
  File.write(path, combined)
  warn "wrote #{path} (#{combined.bytesize / 1024} KiB)"
end

def write_types(dist_dir)
  dts = <<~TS
    declare const Unitsdb: any;
    export = Unitsdb;
    export default Unitsdb;
  TS
  path = File.join(dist_dir, "index.d.ts")
  File.write(path, dts)
  warn "wrote #{path}"
end

ruby_dir = ENV.fetch("RUBY_DIR")
dist_dir = ENV.fetch("DIST_DIR")
runtime_root = ENV.fetch("RUNTIME_PKG_ROOT")
version = ENV.fetch("VERSION")

FileUtils.mkdir_p(dist_dir)

app_code = build_app_code(ruby_dir, dist_dir)
runtime = read_runtime(runtime_root)
build_self_contained(app_code, runtime, version, dist_dir)
write_types(dist_dir)