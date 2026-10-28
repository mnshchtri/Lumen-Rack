# Attach TFLite metadata (input normalization to [-1, 1]) so MediaPipe Tasks can load the BlazeFace model.
import sys, flatbuffers
from mediapipe.tasks.metadata import metadata_schema_py_generated as M
from mediapipe.tasks.metadata import schema_py_generated as S

src, dst = sys.argv[1], sys.argv[2]
buf = bytearray(open(src, 'rb').read())
model = S.ModelT.InitFromObj(S.Model.GetRootAsModel(buf, 0))
sg = model.subgraphs[0]
names = lambda idx: [model.subgraphs[0].tensors[i].name.decode() for i in idx]
print('inputs', names(sg.inputs), 'outputs', names(sg.outputs))

def content(kind, props):
    c = M.ContentT(); c.contentPropertiesType = kind; c.contentProperties = props; return c

img = M.TensorMetadataT(); img.name = 'image'; img.description = 'Input RGB image'
ip = M.ImagePropertiesT(); ip.colorSpace = M.ColorSpaceType.RGB
img.content = content(M.ContentProperties.ImageProperties, ip)
norm = M.NormalizationOptionsT(); norm.mean = [127.5]; norm.std = [127.5]
pu = M.ProcessUnitT(); pu.optionsType = M.ProcessUnitOptions.NormalizationOptions; pu.options = norm
img.processUnits = [pu]
st = M.StatsT(); st.max = [1.0]; st.min = [-1.0]; img.stats = st

outs = []
for n in names(sg.outputs):
    t = M.TensorMetadataT(); t.name = n
    t.content = content(M.ContentProperties.FeatureProperties, M.FeaturePropertiesT())
    outs.append(t)

sgm = M.SubGraphMetadataT(); sgm.inputTensorMetadata = [img]; sgm.outputTensorMetadata = outs
md = M.ModelMetadataT(); md.name = 'BlazeFace short-range'; md.version = '1'; md.minParserVersion = '1.0.0'
md.description = 'MediaPipe BlazeFace short-range face detector (Apache-2.0) with input normalization metadata.'
md.subgraphMetadata = [sgm]
b = flatbuffers.Builder(0); b.Finish(md.Pack(b), b'M001'); meta = b.Output()

mb = S.BufferT(); mb.data = list(meta)
model.buffers.append(mb)
entry = S.MetadataT(); entry.name = 'TFLITE_METADATA'; entry.buffer = len(model.buffers) - 1
model.metadata = [m for m in (model.metadata or []) if m.name != b'TFLITE_METADATA'] + [entry]
b2 = flatbuffers.Builder(0); b2.Finish(model.Pack(b2), b'TFL3')
open(dst, 'wb').write(b2.Output())
print('wrote', dst, len(b2.Output()))
