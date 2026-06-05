"""掃所有 mesh object，依名稱判斷每個器官有哪些 object 可匯出。"""
import bpy
import sys

# 每個器官（外鍵）對到一組 (must contain, must NOT contain) patterns。
ORGAN_PATTERNS = {
    'lung': (['lung'], ['nodes', 'artery', 'vein', 'pleura', 'trunk']),
    'liver': (['liver', 'hepatic'], ['nodes', 'artery', 'vein', 'duct',
                                     'flexure of colon', 'impression']),
    'kidney': (['kidney', 'renal'], ['nodes', 'artery', 'vein', 'plexus',
                                     'recurrent', 'tubercle', 'tubule',
                                     'capsule of kidney', 'pelvis']),
    'stomach': (['stomach', 'gastric'], ['nodes', 'artery', 'vein', 'plexus',
                                         'impression', 'omentum', 'mesogast',
                                         'splenic']),
    'small_intestine': (['small intestine', 'duodenum', 'jejunum', 'ileum'],
                        ['nodes', 'artery', 'vein', 'plexus', 'sulcus',
                         'orifice', 'mucosa', 'mesogast', 'ileocaecal',
                         'iliacus']),
    'large_intestine': (['large intestine', 'colon', 'caecum', 'rectum',
                         'sigmoid colon', 'vermiform appendix'],
                        ['nodes', 'artery', 'vein', 'plexus', 'flexure',
                         'haustr', 'taenia', 'mesocolon', 'mesentery']),
    'spleen': (['spleen', 'splenic'], ['artery', 'vein', 'nodes', 'plexus',
                                       'impression', 'splenius']),
    'pancreas': (['pancreas', 'pancreatic'], ['duct', 'nodes', 'artery',
                                              'vein', 'pancreaticoduodenal',
                                              'impression']),
    'adrenal': (['suprarenal', 'adrenal'], ['artery', 'vein', 'nodes',
                                            'plexus']),
}


def main():
    obj_names = [o.name for o in bpy.data.objects if o.type in ('MESH', 'CURVE')]
    print(f"Total mesh+curve objects: {len(obj_names)}")
    for organ, (musts, nots) in ORGAN_PATTERNS.items():
        matches = []
        for n in obj_names:
            low = n.lower()
            if not any(m in low for m in musts):
                continue
            if any(nt in low for nt in nots):
                continue
            matches.append(n)
        print(f"\n== {organ} == ({len(matches)} matches)")
        for n in matches[:25]:
            print(f"  - {n}")
        if len(matches) > 25:
            print(f"  ... +{len(matches) - 25} more")
    sys.exit(0)


main()
